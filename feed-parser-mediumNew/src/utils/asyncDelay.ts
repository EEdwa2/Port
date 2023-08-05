export async function asyncDelay(time: number) {
	await new Promise(resolve => setTimeout(resolve, time))
}
