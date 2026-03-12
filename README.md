# Gmail Sender – Web Email System

Gmail **App Password** দিয়ে ওয়েব থেকে ইমেইল পাঠানোর সিস্টেম।

## যা দরকার

- Node.js (যেকোনো লেটেস্ট ভার্সন)
- একটা Gmail অ্যাকাউন্ট
- Gmail **App Password** (নিচে কিভাবে বানাবেন)

## Gmail App Password কিভাবে বানাবেন

1. Google Account এ যান: [myaccount.google.com](https://myaccount.google.com)
2. **Security** → **2-Step Verification** চালু করুন (যদি না থাকে)
3. **Security** → **App passwords** এ যান
4. **Select app** → "Mail" বা "Other" বেছে নাম দিন
5. **Generate** চাপুন – ১৬ অক্ষরের একটা পাসওয়ার্ড দেখাবে (যেমন: `abcd efgh ijkl mnop`)
6. এই পাসওয়ার্ডটা কপি করে রাখুন – **এটাই App Password**, আপনার সাধারণ Gmail পাসওয়ার্ড নয়

## সেটআপ

1. প্রজেক্ট ফোল্ডারে টার্মিনাল খুলে:

```bash
npm install
```

2. `.env.example` কপি করে `.env` বানান:

```bash
copy .env.example .env
```

3. `.env` ফাইল খুলে আপনার মান দিন:

```
GMAIL_USER=your.email@gmail.com
GMAIL_APP_PASSWORD=আপনার ১৬ অক্ষরের অ্যাপ পাসওয়ার্ড
```

(App Password এ স্পেস থাকলে থাকতে দিন, যেমন: `abcd efgh ijkl mnop`)

## চালানো

```bash
npm start
```

ব্রাউজারে যান: **http://localhost:3000**

এখন To, Subject আর Message দিয়ে **ইমেইল পাঠান** বাটনে ক্লিক করলেই ইমেইল চলে যাবে।

## ইমেইল ইনবক্সে যাতে যায়

### আপনার পক্ষে (পাঠক)

1. **From নাম সেট করুন** – `.env` এ `GMAIL_FROM_NAME=আপনার নাম` দিন। চেনা নাম থাকলে স্প্যামে যাওয়ার সম্ভাবনা কমে।
2. **Subject ও বার্তা স্বাভাবিক রাখুন** – সব বড় অক্ষর, অতিরিক্ত লিংক বা “FREE”, “ACT NOW” জাতীয় শব্দ কম ব্যবহার করুন।
3. **অতিরিক্ত ইমেইল একসাথে পাঠাবেন না** – Gmail এর লিমিট আছে; ধীরে ধীরে পাঠান।

### প্রাপকের পক্ষে (ইমেইল যার কাছে যাচ্ছে)

প্রাপক Gmail ব্যবহার করলে, আপনার ইমেইল যাতে **সবসময় ইনবক্সে** থাকে (স্প্যাম/প্রমোশনে না যায়), তারা একটা **filter** বানাতে পারেন:

1. Gmail খুলে উপরের **সার্চ বক্সে** ডান পাশের **Show search options** (ফানেল আইকন) চাপুন।
2. **From** এ আপনার ইমেইল ঠিকানা দিন (যেমন: `your.email@gmail.com`)।
3. নিচে **Create filter** চাপুন।
4. **Apply the label:** দিয়ে “Inbox” বা “Primary” নিশ্চিত করুন; অথবা **Never send it to Spam** চেক করুন।
5. **Create filter** সেভ করুন।

বিস্তারিত: [Gmail – Create rules to filter your emails](https://support.google.com/mail/answer/6579?hl=en)

## নিরাপত্তা

- App Password কখনো ফ্রন্টএন্ড বা পাবলিক জায়গায় দেবেন না
- `.env` ফাইল গিটে কমিট করবেন না (ইতিমধ্যে নিরাপদ রাখার জন্য সতর্ক থাকুন)
