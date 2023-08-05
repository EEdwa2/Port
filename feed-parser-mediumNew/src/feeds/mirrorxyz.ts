import fs from "fs"
import { request, gql } from "graphql-request"
import {
	findImagesAndVideosFromMarkdown,
	typedLog,
	File,
	downloadAttachmentAndSaveToS3,
} from "../utils/utils"
import { MessageEntity } from "../entities/message.entity"
import { AttachmentEntity } from "../entities/attachment.entity"
import { AttachmentType } from "../types/types"
import { v4 as uuid } from "uuid"
import {
	attachmentRepository,
	messageRepository,
	observableLinksRepository,
	projectRepository,
} from "../database"
import axios from "axios"
import { ProjectEntity } from "../entities/project.entity"
import { ObservableLinkEntity } from "../entities/observable-link.entity"
import { MIRROR_REFRESH_TIMEOUT_MS } from "../constraints"
import { slack } from "../utils/slack"
import { asyncDelay } from "../utils/asyncDelay"
import * as url from "url"

interface MirrorArticle {
	id: number
	body: string
	digest: string
	title: string
	publishedAtTimestamp: number
}

interface Project {
	address: string
	avatarUrl: string
	description: string
	name: string
	ens: string
}

const SINCE_DATE = new Date(2022, 4, 1, 12, 0)

export const startMirrorParser = async (projectsLinks: string[]) => {
	if (!fs.existsSync("./images")) {
		fs.mkdirSync("./images")
	}
	if (!fs.existsSync("./images/mirrorxyz")) {
		fs.mkdirSync("./images/mirrorxyz")
	}
	if (!fs.existsSync("./images/mirrorxyz/attachments")) {
		fs.mkdirSync("./images/mirrorxyz/attachments")
	}

	try {
		while (true) {
			console.log("Mirror start")
			for (const link of projectsLinks) {
				await parseProject(link)
			}
			console.log("Mirror end")
			await asyncDelay(MIRROR_REFRESH_TIMEOUT_MS)
		}
	} catch (err: any) {
		await slack(
			`An error happend on MirrorXYZ: ${err.message}, ${err.stack}`,
		)
	}
}

const parseProject = async (link: string) => {
	let project = await projectRepository.findOneBy({
		url: link,
	})

	if (!project) {
		const mirrorProject = await getProjectInfo(link)

		if (!mirrorProject) return

		project = createProject(mirrorProject, link)
		await projectRepository.save(project)
	}

	if (!project) return

	typedLog("mirrorxyz", `Parsing project ${link}`)

	const articles = await getProjectArticles(project)

	const dbLink = await observableLinksRepository.findOneBy({
		link: project.url,
	})

	if (articles) {
		for (const article of articles) {
			const message = createMessage(article, project, dbLink)
			await messageRepository.save(message)
			message.attachments && downloadAttachments(message.attachments)
		}
	}

	typedLog("mirrorxyz", `Finished project ${link}`)
}

const getProjectInfo = async (projectLink: string): Promise<Project | null> => {
	try {
		const htmlData = await axios
			.get(projectLink)
			.then(response => response.data)

		const splitData = htmlData.split(
			'<script id="__NEXT_DATA__" type="application/json">',
		)[1]
		const propsObject = splitData.split("</script>")[0]

		const parsedPropsObject = JSON.parse(propsObject)

		const projectInfo =
			parsedPropsObject.props.pageProps.publicationLayoutProject

		return {
			address: projectInfo.address,
			avatarUrl: projectInfo.avatarURL,
			description: projectInfo.description,
			name: projectInfo.displayName,
			ens: projectInfo.ens,
		}
	} catch (e: any) {
		typedLog("mirrorxyz", `Error getting project, ${e}`)
		await slack(
			`Error getting project, ${projectLink}, ${e.message} ${e.stack}`,
		)
		return null
	}
}

const getProjectAddressFromUrl = (url: string) => {
	const dirtyProjectAddress = url.split("https://").at(1)
	const clearFromSlash =
		dirtyProjectAddress?.at(-1) === "/"
			? dirtyProjectAddress.slice(0, -1)
			: dirtyProjectAddress

	if (clearFromSlash?.includes("mirror.xyz/")) {
		return clearFromSlash.replace("mirror.xyz/", "")
	} else {
		return clearFromSlash
	}
}

const getProjectArticles = async (project: ProjectEntity) => {
	const projectAddress = getProjectAddressFromUrl(project.url)

	if (!projectAddress) {
		typedLog(
			"mirrorxyz",
			`Invalid project url ${project.url}, example = https://dev.mirror.xyz/`,
		)
		return null
	}

	const lastSaved: MessageEntity | undefined = await messageRepository
		.find({
			where: {
				project: {
					id: project.id,
				},
			},
			skip: 0,
			take: 1,
			order: { createdTimestamp: "DESC" },
		})
		.then(result => result[0])

	const limit = 9

	const allPosts: MirrorArticle[] = []

	let reachedLastSaved = false
	let reachedSinceDate = false

	while (true) {
		const posts = await articlesQuery(
			projectAddress,
			limit,
			allPosts.length ? allPosts[allPosts.length - 1].id : null,
		)

		if (posts === null) break

		for (const post of posts) {
			if (post.digest === lastSaved?.id) {
				reachedLastSaved = true
				break
			} else if (
				post.publishedAtTimestamp * 1000 <
				SINCE_DATE.getTime()
			) {
				reachedSinceDate = true
				break
			} else {
				allPosts.push(post)
			}
		}

		typedLog(
			"mirrorxyz",
			`Fetched ${allPosts.length} posts from ${projectAddress}`,
		)

		if (posts.length < limit || reachedLastSaved || reachedSinceDate) break
	}
	return allPosts
}

const articlesQuery = async (
	projectAddress: string,
	limit: number,
	cursor: number | null,
): Promise<MirrorArticle[] | null> => {
	try {
		const query = gql`query ProjectPage($projectAddress: String!, $limit: Int) {  projectFeed(projectAddress: $projectAddress, limit: $limit, cursor: ${cursor}) {    _id    domain    ens    theme {      accent      colorMode      __typename    }    displayName    ens    address    ...projectPage    ...publicationLayoutProject    __typename  }}fragment projectPage on ProjectType {  _id  address  avatarURL  description  displayName  domain  ens  theme {    accent    colorMode    __typename  }  headerImage {    id    url    __typename  }  posts {    ... on crowdfund {      _id      id      __typename    }    ... on entry {      _id      id      body      digest      title      publishedAtTimestamp      writingNFT {        _id        optimisticNumSold        proxyAddress        purchases {          numSold          __typename        }        __typename      }      featuredImage {        mimetype        url        __typename      }      publisher {        ...publisherDetails        __typename      }      settings {        ...entrySettingsDetails        __typename      }      __typename    }    __typename  }  __typename}fragment publisherDetails on PublisherType {  project {    ...projectDetails    __typename  }  member {    ...projectDetails    __typename  }  __typename}fragment projectDetails on ProjectType {  _id  address  avatarURL  description  displayName  domain  ens  gaTrackingID  mailingListURL  headerImage {    ...mediaAsset    __typename  }  theme {    ...themeDetails    __typename  }  __typename}fragment mediaAsset on MediaAssetType {  id  cid  mimetype  sizes {    ...mediaAssetSizes    __typename  }  url  __typename}fragment mediaAssetSizes on MediaAssetSizesType {  og {    ...mediaAssetSize    __typename  }  lg {    ...mediaAssetSize    __typename  }  md {    ...mediaAssetSize    __typename  }  sm {    ...mediaAssetSize    __typename  }  __typename}fragment mediaAssetSize on MediaAssetSizeType {  src  height  width  __typename}fragment themeDetails on UserProfileThemeType {  accent  colorMode  __typename}fragment entrySettingsDetails on EntrySettingsType {  description  metaImage {    ...mediaAsset    __typename  }  title  __typename}fragment publicationLayoutProject on ProjectType {  _id  avatarURL  displayName  domain  address  ens  gaTrackingID  mailingListURL  description  __typename}`

		const response = await request(
			"https://mirror-api.com/graphql",
			query,
			{
				projectAddress: projectAddress,
				limit: limit,
				cursor: cursor,
			},
			{
				Host: "mirror-api.com",
				Origin: "https://dev.mirror.xyz",
				Referer: "https://dev.mirror.xyz/",
			},
		)

		return response.projectFeed.posts
	} catch (e: any) {
		console.error(e)
		typedLog("mirrorxyz", `Error getting posts, ${e}`)

		// await slack(
		// 	`Error getting posts, ${projectAddress}, ${e.message} ||| ${e.stack}`,
		// )
		return null
	}
}

const createProject = (project: Project, projectUrl: string) => {
	const dbProject = new ProjectEntity()

	dbProject.address = project.address
	dbProject.name = project.name
	dbProject.avatarUrl = project.avatarUrl
	dbProject.description = project.description
	dbProject.ens = project.ens
	dbProject.url = projectUrl

	return dbProject
}

const createMessage = (
	article: MirrorArticle,
	project: ProjectEntity,
	link: ObservableLinkEntity | null,
) => {
	const dbMessage = new MessageEntity()

	dbMessage.id = article.digest
	dbMessage.content = article.body
	dbMessage.createdTimestamp = new Date(article.publishedAtTimestamp * 1000)
	dbMessage.title = article.title
	dbMessage.project = project
	dbMessage.link = link ? link : null

	//Parse content attachment from markdown
	const attachments = findImagesAndVideosFromMarkdown(article.body)
	dbMessage.attachments = createAttachments(attachments, dbMessage)

	return dbMessage
}

const createAttachments = (
	attchs: { images: File[]; videos: File[] },
	dbMessage: MessageEntity,
): AttachmentEntity[] | null => {
	const attachments: AttachmentEntity[] = [
		...attchs.images.map(image =>
			createAttachment("image", image, dbMessage),
		),
		...attchs.videos.map(video =>
			createAttachment("video", video, dbMessage),
		),
	]
	return attachments.length ? attachments : null
}

const createAttachment = (
	type: AttachmentType,
	metadata: File,
	message: MessageEntity,
) => {
	const attachment = new AttachmentEntity()

	attachment.id = uuid()
	attachment.type = type
	attachment.url = metadata.link
	attachment.message = message

	return attachment
}

const downloadAttachments = async (attachments: AttachmentEntity[]) => {
	const tasks = attachments.map(attachment => {
		if (attachment.type === "image") {
			return downloadAttachmentAndSaveToS3(attachment, "mirrorxyz")
		}
	})
	const uploadedAttachments = await Promise.all(tasks)

	const newAttachments = uploadedAttachments.map(elem => {
		if (elem?.url) {
			const attachment = elem.attachment
			attachment.s3Url = elem.url
			return attachment
		}
	})

	const newAttachmentsFiltered = newAttachments.filter(
		elem => !!elem,
	) as AttachmentEntity[]

	await attachmentRepository.save(newAttachmentsFiltered)
}
