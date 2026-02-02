const { By, Key, until, Builder } = require("selenium-webdriver");
require("chromedriver");

async function test() {
	let driver = await new Builder().forBrowser("chrome").build();
	await driver.get("http://localhost:5173");

	// const sentencesBefore = await driver.wait(
	// 	until.elementsLocated(By.className("sentence-item")),
	// 	10000
	// );
	// console.log("Number of sentences:", sentencesBefore.length);

	await driver.findElement(By.id("chineseText")).sendKeys("睡觉吧");
	// await driver.findElement(By.id("pinyin")).sendKeys("shui jiao ba");
	await driver
		.findElement(By.id("englishTranslation"))
		.sendKeys("Let's go to sleep");
	await driver.findElement(By.name("add-sentence")).click();

	const sentencesAfter = await driver.wait(
		until.elementsLocated(By.className("sentence-item")),
		10000
	);
	console.log("Number of sentences after adding:", sentencesAfter.length);
}

test();
