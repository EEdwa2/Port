import { IncomingWebhook } from "@slack/webhook"

export async function slack(message: string): Promise<void> {
	const url = process.env.SLACK_WEBHOOK_URL as string
	const webhook = new IncomingWebhook(url)

	await webhook.send({
		text: message,
	})
}
