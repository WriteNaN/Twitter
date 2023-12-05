# Twitter API Automation Guide

## Introduction
Welcome to the unofficial Twitter API Automation guide. This document is designed to help you understand and utilize an automated API for Twitter for educational purposes. It is crucial to be aware of and comply with Twitter's policies before using this program. The responsibility for the use of the code lies solely with the individual.

### Disclaimer
The code and associated program described herein are created solely for educational and instructional purposes. Users should employ this program within the bounds of Twitter's policies and guidelines. I disclaim responsibility for any misuse of the code.

### Features
- Automatically post unlimited tweets from your account.
- User-friendly and easy to set up.

## Prerequisites
Before proceeding, ensure that you have both Chromium and Puppeteer installed on your system, as they are essential for running the Twitter automation scripts.

### Login via Cookies
Currently, the only supported login method is through cookies, which is a reliable way to avoid captchas and maintain ease of access. Please note that mail and password-based login will not be supported to enforce better security practices.

<details>
<summary>Guide to Importing Cookies from a Logged-in Account</summary>

To import cookies, you need to obtain them in JSON format. This can be done using the following steps:

1. Install the "EditThisCookie" extension, available at the [Chrome Web Store](https://chrome.google.com/webstore/detail/editthiscookie/fngmhnnpilhplaeedifhccceomclgfbg).
2. Navigate to [Twitter.com](https://twitter.com/home) and sign in to your account.
3. Click on the "EditThisCookie" extension icon.
4. Use the "Export Cookies" feature within the extension to save your cookies to a JSON file.

Place the exported cookies.json file in the same directory as your Twitter automation script or redirect to specific path.
</details>

## Quick Start Guide

Here's a simple example to get you started with tweeting using the Twitter Automation API:

```js
const path = require("path");
const { Client } = require("./index");

const twitterClient = new Client('./cookies.json', {
  timeout: 1000,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.1425.130 Safari/537.36'
});

twitterClient.on('ready', (isReady) => {
  if (isReady) {
    console.log('Twitter client is ready');
    // Example usage
    (async () => {
      const user = await twitterClient.fetchProfile('twitter_handle');
      console.log('User details:', user);
      await twitterClient.tweet({
        content: "Hello World!",
      });
      await twitterClient.close();
    })();
  } else {
    console.log('Twitter client failed to initialize');
  }
});
```
![image](https://github.com/WriteNaN/Twitter/assets/151211283/58da8fa6-53fd-44a3-b1fc-bf521e2ed534)


### Attaching files with the tweet
```js
await twitter.tweet({
    content: "Hello World!",
    media: "path to file"
});
```
![image](https://github.com/WriteNaN/Twitter/assets/151211283/1c2539e0-c166-4c67-9da3-3adf8bd43752)

### creating polls
```js
await twitter.tweet({
    content: "I use crypto since its", // Question
    poll: {
      choices: ['Anonymous', 'Permissionless', 'Instant', 'Verifyable'],
      duration: {days: 2, hours: 1, minutes: 1},
    }
});
```
![image](https://github.com/WriteNaN/Twitter/assets/151211283/a9a93123-8466-4747-b04f-a52461ef5bc9)


