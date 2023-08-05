import "reflect-metadata"
import dotenv from "dotenv"

dotenv.config()

import {
	DISCORD_LINK_BASE,
	MIRROR_LINK_BASE,
	TELEGRAM_LINK_BASE,
	TWITTER_LINK_BASE,
} from "./constraints"

import { AppDataSource, observableLinksRepository } from "./database"
import { ObservableLinkEntity } from "./entities/observable-link.entity"
import { startDiscordParser } from "./feeds/discord"
import { startTwitterParser } from "./feeds/twitter"
import { startMirrorParser } from "./feeds/mirrorxyz"
import { startMediumParser } from "./feeds/medium"
import { startTelegramParser } from "./feeds/telegram"
import { uploadFileToS3 } from "./s3/upload"
import { startOpenGraphEnricher } from "./open-graph/enricher"
import { LinkType } from "./types/types"

const start = async () => {
	//Init typeorm db

	// const uploadLink = await uploadFileToS3("./Makefile")
	// console.log("uploadLink: ", uploadLink);

	await AppDataSource.initialize()

	const observables = await getObservables()

	const modeRaw = process.env.MODE || ""
	const mode = modeRaw.split(",").filter(t => !!t)

	if (mode.includes("discord")) {
		startDiscordParser(observables.discord)
	}
	if (mode.includes("twitter")) {
		startTwitterParser(observables.twitter)
	}
	if (mode.includes("mirror")) {
		startMirrorParser(observables.mirror)
	}
	if (mode.includes("telegram")) {
		startTelegramParser(observables.telegram)
	}
	if (mode.includes("medium")) {
		startMediumParser(observables.medium)
	}

	if (mode.includes("opengraph")) {
		startOpenGraphEnricher()
	}
}

start()

const getObservables = async () => {
	const observableLinks = await observableLinksRepository.find()

	return {
		discord: getDiscordObservables(observableLinks),
		twitter: getTwitterObservableUsernames(observableLinks),
		mirror: getMirrorObservableLinks(observableLinks),
		telegram: getTelegramObservableLinks(observableLinks),
		medium: getMediumObservableLinks(observableLinks),
	}
}

const getDiscordObservables = (observableLinks: ObservableLinkEntity[]) =>
	new Map(
		Object.entries(
			observableLinks
				.filter(l => l.link.includes(DISCORD_LINK_BASE))
				.reduce((p, c) => {
					const [channelId, guildId] = c.link.split("/").reverse()
					return {
						...p,
						[guildId]: [...(p[guildId] || []), channelId],
					}
				}, {} as Record<string, string[]>),
		),
	)

const getTwitterObservableUsernames = (
	observableLinks: ObservableLinkEntity[],
) => observableLinks.filter(l => l.link.includes(TWITTER_LINK_BASE))

const getMirrorObservableLinks = (observableLinks: ObservableLinkEntity[]) =>
	observableLinks
		.filter(l => l.link.includes(MIRROR_LINK_BASE))
		.map(l => l.link)

const getTelegramObservableLinks = (observableLinks: ObservableLinkEntity[]) =>
	observableLinks.filter(l => l.link.includes(TELEGRAM_LINK_BASE))

	const getMediumObservableLinks = (observableLinks: ObservableLinkEntity[]) =>
	observableLinks
	.filter(l => l.type === LinkType.MEDIUM)
	.map(l => l.link)
