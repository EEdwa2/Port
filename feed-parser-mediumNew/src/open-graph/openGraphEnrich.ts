// import { fetch as ogFetch } from "fetch-opengraph"
import { In } from "typeorm"
import { linkPreviewRepository, messageRepository } from "../database"
import { LinkPreviewEntity } from "../entities/link-preview"
import { MessageEntity } from "../entities/message.entity"
import TwitterApi, {
	MediaObjectV2,
	TweetV2,
	TwitterApiReadOnly,
	UserV2Result,
} from "twitter-api-v2"
import fetch from "node-fetch"
import { load as cheerioLoad } from "cheerio"
import { asyncDelay } from "../utils/asyncDelay"

function isURL(u: string): boolean {
	try {
		new URL(u)
		return true
	} catch (err) {
		return false
	}
}

let twitterClient!: TwitterApiReadOnly

export async function ogFetch(
	url: string,
	redirectCount: number = 0,
): Promise<Record<string, string>> {
	if (redirectCount > 5) {
		return {}
	}
	if (url.startsWith("https://t.co/")) {
		const tempResponse = await fetch(url, {
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
			},
			timeout: 5000,
		})
		const tempBody = await tempResponse.text()
		if (tempBody.includes('<META http-equiv="refresh" content="0;URL=')) {
			const newUrl = tempBody
				.split('<META http-equiv="refresh" content="0;URL=')[1]
				.split('">')[0]
			if (newUrl && newUrl !== url && isURL(newUrl)) {
				return ogFetch(newUrl, redirectCount++)
			}
		}
		// <META http-equiv="refresh" content="0;URL=https://twitter.com/elonmusk/status/1600439088560996353/video/1">
	}
	if (/^https:\/\/twitter\.com\/(.*?)\/status\/(.*?)/i.test(url)) {
		if (!twitterClient) {
			if (!twitterClient) {
				const bearer = process.env.TWITTER_APP_BEARER
				twitterClient = new TwitterApi(bearer!).readOnly
			}
		}
		const tweetId = url
			.split("?")[0]
			.split("/status/")
			.at(-1)!
			.split("/")
			.at(0)!
		const tweetData = await twitterClient.v2.singleTweet(tweetId, {
			expansions: ["author_id", "attachments.media_keys"],
			"user.fields": ["username", "name", "profile_image_url"],
			"media.fields": ["type", "url", "preview_image_url", "alt_text"],
		})
		await asyncDelay(2000)
		if (tweetData && tweetData.data) {
			const userData = tweetData.includes?.users?.at(0)
			const mediaData = tweetData.includes?.media?.at(0)
			return {
				"twitter:id": tweetData.data.id,
				"twitter:author_id": tweetData.data.author_id || "",

				"og:title": userData ? `${userData.name} Tweet` : `Tweet`,
				"og:description": tweetData.data.text,
				"og:url": url,

				...(userData
					? {
							"twitter:author_username": userData.username,
							"twitter:author_name": userData.name,
							"twitter:author_profile_image_url":
								userData.profile_image_url || "",
					  }
					: {}),

				...(mediaData
					? {
							"twitter:media_type": mediaData.type || "",
							"twitter:media_url": mediaData.url || "",
							...(mediaData.type === "photo"
								? {
										"og:image": mediaData.url || "",
								  }
								: {}),
					  }
					: {}),
			}
		} else {
			return {}
		}
	}
	let response = await fetch(url, {
		headers: {
			"User-Agent":
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
		},
		timeout: 5000,
	})
	if (response.status === 302) {
		if (isURL(response.headers.get("location") || "")) {
			return ogFetch(response.headers.get("location")!, redirectCount++)
		} else {
			return {}
		}
	}
	const textContent = await response.text()
	try {
		const $ = cheerioLoad(textContent)
		const metas = $("meta")
			.toArray()
			.map(e => ({
				property: $(e).attr("property"),
				content: $(e).attr("content"),
			}))

		return metas
			.filter(m => m.property && m.property.includes(":"))
			.reduce(
				(p, c) => ({
					...p,
					[c.property!]: c.content!,
				}),
				{
					expandedUrl: url,
				},
			)
	} catch (err) {
		return {}
	}
}

export async function openGraphEnrich(
	message: MessageEntity,
	saveMessage = false,
) {
	console.log(`OG | Enriching: ${message.id}`)

	const extractedLinks: string[] = []
	const content = message.content
	content.replace(
		/(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#\/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[A-Z0-9+&@#\/%=~_|$])/gim,
		(substr, ...args) => {
			extractedLinks.push(substr)
			return substr
		},
	)

	if (extractedLinks.length) {
		const normalizedLinks = extractedLinks.map(link => ({
			link: link,
			normalized: (() => {
				try {
					return new URL(link)
				} catch (err) {
					return null
				}
			})(),
		}))

		const searchableLinks = normalizedLinks.filter(l => !!l.normalized)
		const searchedLinks = await linkPreviewRepository.find({
			where: {
				rawUrl: In(searchableLinks.map(l => l.link)),
			},
		})

		const foundLinks = normalizedLinks.map(link => {
			return {
				...link,
				dbLink: searchedLinks.find(s => s.rawUrl === link.link),
			}
		})

		const toSave: LinkPreviewEntity[] = []

		for (const link of foundLinks) {
			if (link.dbLink) {
				const copy = new LinkPreviewEntity()
				copy.rawUrl = link.dbLink.rawUrl
				copy.expandedUrl = link.dbLink.expandedUrl
				copy.title = link.dbLink.title
				copy.description = link.dbLink.description
				copy.imagePreview = link.dbLink.imagePreview
				copy.failed = link.dbLink.failed
				copy.website = link.dbLink.website
				copy.websiteFavicon = link.dbLink.websiteFavicon
				copy.rawMeta = link.dbLink.rawMeta
				copy.message = message
				toSave.push(copy)
			} else {
				console.log(`OG | Harvesting: ${link.link}`)
				let linkData: Record<string, string> = {}
				let failed = false
				try {
					linkData = await ogFetch(link.link)
				} catch (err) {
					failed = true
				}
				const newOne = new LinkPreviewEntity()
				newOne.rawUrl = link.link
				newOne.expandedUrl =
					linkData.expandedUrl || linkData["og:url"] || link.link
				newOne.title = linkData["og:title"] || ""
				newOne.description = linkData["og:description"] || ""
				newOne.imagePreview =
					linkData["og:image"]?.replace(
						"undefined//discord.com/",
						"https://discord.com/",
					) || ""
				newOne.failed = failed || Object.keys(linkData).length === 0
				newOne.website = link.normalized?.host || ""
				newOne.websiteFavicon = ""
				newOne.rawMeta = linkData
				newOne.message = message
				toSave.push(newOne)
			}
		}

		if (toSave.length) {
			await linkPreviewRepository.save(toSave)
		}
	}

	message.ogEnriched = true

	if (saveMessage) {
		await messageRepository.save(message)
	}
}
