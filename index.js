const puppeteer = require("puppeteer");
const { exec } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("fs");
const path = require("path");
const EventEmitter = require("events");

class Twitter extends EventEmitter {
  constructor(cookiePath) {
    super();
    this.xpaths = require("./xpath.json");
    this.defaultType = { delay: 30 };
    this.sleep = (waitTimeInMs) =>
      new Promise((resolve) => setTimeout(resolve, waitTimeInMs));
    this._init(cookiePath);
  }

  async _init(cookiePath) {
    const { stdout: chromiumPath } = await promisify(exec)("which chromium");
    //console.log("found chromium");
    this.executablePath = chromiumPath.trim();

    const cookiesString = await fs.promises.readFile(cookiePath) || await fs.promises.readFile(
      path.join(__dirname, "cookies.json")
    );
    this.cookies = JSON.parse(cookiesString);

    this.browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1920,1080"],
      executablePath: this.executablePath,
    });
    //console.log("created browser");

    this.page = await this.browser.newPage();

    for (const cookie of this.cookies) {
      await this.page.setCookie(cookie);
    }

    await this.page.goto("https://twitter.com/home");
  }

  async takeScreenshot() {
    await new Promise((res) => setTimeout(res, 2000));
    await this.page.screenshot({ path: "screenshot.png" });
  }

  async close() {
    await this.browser.close();
    process.exit(0);
  }

  async tweet({ content, media, poll, mediaTimeout }) {
    if (!mediaTimeout) mediaTimeout = 1000;
    if (media && poll)
      return console.error("Only one of media or poll can exist in one tweet");

    const activeURL = await this.page.url();
    const url = `https://twitter.com/home`;

    if (activeURL !== url) await this.page.goto(url);

    await this.page.waitForXPath(this.xpaths.tweet_div);
    const tweetModal = await this.page.$x(this.xpaths.tweet_modal);
    await tweetModal[0].click();
    await tweetModal[0].type(`  ${content}`, this.defaultType);

    if (media) {
      const mediaPath = media;
      const allowedTypes = new Set([
        ".jpeg",
        ".jpg",
        ".png",
        ".webp",
        ".gif",
        ".mp4",
        ".mov",
      ]);
      const mimeType = path.extname(mediaPath).toLowerCase();

      if (!fs.existsSync(mediaPath) || !allowedTypes.has(mimeType)) {
        console.log(`Invalid mediaPath or file type not allowed: ${mediaPath}`);
        return;
      }

      console.log("looking for file input");
      const [fileInput] = await this.page.$$('input[type="file"]');
      if (fileInput) {
        await fileInput.uploadFile(mediaPath);
        console.log("File uploaded");
      } else {
        console.log("No file input found on the page");
      }
      await this.sleep(mediaTimeout);
    }

    if (poll) {
      this.page.waitForXPath(this.xpaths.tweet_poll);
      const pollModal = await this.page.$x(this.xpaths.tweet_poll);
      
      await pollModal[0].click();

      const numberOfOptions = this.xpaths.tweet_poll_options.length;
      if (poll.choices.length > numberOfOptions) {
        throw new Error(`Maximum ${numberOfOptions} choices allowed.`);
      } else if (poll.choices.length < 2) {
        throw new Error('Minimum 2 choices required.');
      }

      for (let index = 0; index < poll.choices.length; index++) {
        if (index >= 2) { 
          await (await this.page.$x(this.xpaths.tweet_poll_add[index - 2]))[0].click();
        }
        const [option] = await this.page.$x(this.xpaths.tweet_poll_options[index]);
        await option.click();
        await option.type(poll.choices[index], this.defaultType);
      }

      const daysOptionValue = poll.duration.days;
      const [daysSelect] = await this.page.$x(this.xpaths.tweet_poll_duration.days);
      await daysSelect.select(daysOptionValue.toString());
      const [hoursSelect] = await this.page.$x(this.xpaths.tweet_poll_duration.hours);
      await hoursSelect.select(poll.duration.hours.toString());
      const [minutesSelect] = await this.page.$x(this.xpaths.tweet_poll_duration.minutes);
      await minutesSelect.select(poll.duration.minutes.toString());
      await this.sleep(mediaTimeout);
      //await this.page.screenshot({path: "screenshot.png"});
    }

    const nextButton = await this.page.waitForXPath(this.xpaths.tweet_enter, { visible: true });
    await nextButton.click();

    await this.sleep(500);

    return true;
  }
}

module.exports = Twitter;
