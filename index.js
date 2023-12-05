const puppeteer = require("puppeteer");
const { exec } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("fs");
const path = require("path");
const EventEmitter = require("events");
const { launch, getStream } = require("puppeteer-stream");

class Client extends EventEmitter {
  constructor(cookiePath, {timeout, userAgent}) {
    super();
    this.xpaths = require("./xpath.json");
    this.defaultType = { delay: 30 };
    this.sleep = (waitTimeInMs) =>
      new Promise((resolve) => setTimeout(resolve, waitTimeInMs));
    this._init(cookiePath, userAgent);
  }

  async _init(cookiePath, userAgent=('Mozilla/5.0 (X11; Linux x86_64)'+'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.39 Safari/537.36')) {
    const { stdout: chromiumPath } = await promisify(exec)("which chromium");
    //console.log("found chromium");
    this.executablePath = chromiumPath.trim();

    const cookiesString = await fs.promises.readFile(cookiePath);
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

    await this.page.setUserAgent(userAgent);

    await this.page.goto("https://twitter.com/home");

    await this.page.waitForSelector(this.xpaths.profile);
    await this.page.click(this.xpaths.profile);
    const usernameHandle = await this.page.waitForXPath(this.xpaths.username_span);
    const displayNameHandle = await this.page.waitForXPath(this.xpaths.displayname_span);
    const displayAboutHandle = await this.page.waitForXPath(this.xpaths.display_about);
    const displayImageHandle = await this.page.waitForXPath(this.xpaths.display_image);
    const displayBannerHandle = await this.page.waitForXPath(this.xpaths.display_banner);
    const username = usernameHandle ? await this.page.evaluate(element => element.innerHTML, usernameHandle) : null;
    const displayName = displayNameHandle ? await this.page.evaluate(element => element.innerHTML, displayNameHandle) : null;
    const displayAbout = displayAboutHandle ? await this.page.evaluate(element => element.innerText.trim(), displayAboutHandle): null;
    const displayImage = displayImageHandle ? await this.page.evaluate(element => element.style.backgroundImage.slice(4, -1).replace(/"/g, ""), displayImageHandle): null;
    const displayBanner = displayBannerHandle ? await this.page.evaluate(element => element.src, displayBannerHandle) : null;
    

    this.user = {
      username,
      displayName,
      displayAbout: displayAbout.replace(/\n/g, ""),
      displayImage,
      displayBanner
    };
    return this.emit('ready', true);
  }

  async takeScreenshot() {
    await this.page.screenshot({ path: "screenshot.png" });
  }

  async close() {
    await this.browser.close();
    process.exit(0);
  }

  async tweet({ content, media, poll, mediaTimeout = 2000 }) {
    if (media && poll)
      return console.error("Only one of media or poll can exist in one tweet");

    const activeURL = await this.page.url();
    const url = `https://twitter.com/home`;

    if (activeURL !== url) {
      await this.page.goto(url);
      await this.page.waitForNetworkIdle();
    }

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

    // Replace the above lines with this code to wait for the button to be enabled and then click
    await this.page.waitForFunction(
      xpath => {
        const element = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        return element && !element.disabled;
      },
      {},
      this.xpaths.tweet_enter
    );
    const [tweetButton] = await this.page.$x(this.xpaths.tweet_enter);
    if (tweetButton) {
      await tweetButton.click();
      await this.sleep(1000);
      try {await tweetButton.click();} catch {};
    } else {
      throw new Error("Tweet button not found");
    }

    await this.sleep(3000);

    await this.page.screenshot({ path: "screenshot.png" });

    return true;
  }

  async fetchProfile(username) {
    await this.page.goto(`https://twitter.com/${username}`);
    const usernameHandle = await this.page.waitForXPath(this.xpaths.username_span);
    const displayNameHandle = await this.page.waitForXPath(this.xpaths.displayname_span);
    const displayAboutHandle = await this.page.waitForXPath(this.xpaths.display_about);
    const displayImageHandle = await this.page.waitForXPath(this.xpaths.display_image);
    const displayBannerHandle = await this.page.waitForXPath(this.xpaths.display_banner);
    const usernamex = usernameHandle ? await this.page.evaluate(element => element.innerHTML, usernameHandle) : null;
    const displayName = displayNameHandle ? await this.page.evaluate(element => element.innerHTML, displayNameHandle) : null;
    const displayAbout = displayAboutHandle ? await this.page.evaluate(element => element.innerText.trim(), displayAboutHandle): null;
    const displayImage = displayImageHandle ? await this.page.evaluate(element => element.style.backgroundImage.slice(4, -1).replace(/"/g, ""), displayImageHandle): null;
    const displayBanner = displayBannerHandle ? await this.page.evaluate(element => element.src, displayBannerHandle) : null;


    const user = {
      username: usernamex,
      displayName,
      displayAbout: displayAbout.replace(/\n/g, ""),
      displayImage,
      displayBanner
    };

    return user;
  }

  async getStream(){
    await getStream(this.page, { audio: true, video: true });
  }
}

module.exports = {Client};
