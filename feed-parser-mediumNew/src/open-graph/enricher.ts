import { messageRepository } from "../database"
import { asyncDelay } from "../utils/asyncDelay"
import { slack } from "../utils/slack"
import { openGraphEnrich } from "./openGraphEnrich"

export async function startOpenGraphEnricher() {
	console.log("OG Enricher started")

	while (true) {
		console.log("OG Enrich cycle started")

		const total = await messageRepository.count({
			where: {
				ogEnriched: false,
			},
		})

		console.log(`OG | To enrich: ${total}`)

		let i = 0

		while (true) {
			console.log(`OG | Enriching ${i} / ${total}`)

			const messages = await messageRepository.find({
				where: {
					ogEnriched: false,
				},
				order: {
					createdTimestamp: "DESC",
				},
				take: 10,
			})

			i += 10

			if (!messages.length) {
				break
			}

			for (const message of messages) {
				try {
					await openGraphEnrich(message, true)
				} catch (err: any) {
					console.error(
						`OG | Error enriching: `,
						message,
						err.message,
						err.stack,
					)
					await slack(
						`Enrichment error: ${err.message} ${
							err.stack
						} ${JSON.stringify(message, null, "\t")}`,
					)
				}
			}

			await asyncDelay(500)
		}

		await asyncDelay(10000)
	}
	//
}
