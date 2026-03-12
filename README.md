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

## Deployment কিভাবে করবেন (VPS এ)

VPS এ একবার সেটআপ করতে চাইলে নিচের ধাপগুলো অনুসরণ করুন।

### ধাপ ১: VPS এ প্রজেক্ট আনুন

VPS এ SSH দিয়ে ঢুকে (Ubuntu/Debian ধরুন):

```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/adnanahamed66772ndpc/GMAILSENDER.git
cd GMAILSENDER
```

### ধাপ ২: Auto setup script চালান

একটাই কমান্ড – এর মধ্যে Node, PM2, firewall, `.env` ইত্যাদি সেট হয়ে যাবে:

```bash
bash scripts/vps-setup.sh
```

**Domain ব্যবহার করবেন না** (শুধু VPS IP দিয়ে ঢুকবেন) তাহলে কিছু extra সেট করবেন না। Script নিজে থেকে port খুলে দেবে আর `BASE_URL` ঠিক করে দেবে।

**Domain + SSL চাইলে** আগে এগুলো সেট করে তারপর script চালান:

```bash
export DOMAIN=yourdomain.com
export BASE_URL=https://yourdomain.com
export ENABLE_SSL=1
bash scripts/vps-setup.sh
```

### ধাপ ৩: Gmail / SMTP সেট করুন

দুইভাবে একটাও করতে হবে:

- **Option A:** `.env` ফাইল এডিট করে দিন: `GMAIL_USER=আপনার@gmail.com` এবং `GMAIL_APP_PASSWORD=আপনার অ্যাপ পাসওয়ার্ড`
- **Option B:** ব্রাউজারে app খুলে **SMTP Settings** ট্যাবে গিয়ে Host, Username, Password সেভ করুন

### ধাপ ৪: UI এ ঢুকুন

- **শুধু IP:** ব্রাউজারে যান `http://আপনার_VPS_IP:3000`
- **Domain দিয়ে:** `http://yourdomain.com` বা `https://yourdomain.com` (SSL চালু থাকলে)

বিস্তারিত ধাপ ও ট্রাবলশুটিং নিচের **Deploy on any VPS** সেকশনে আছে।

---

## Deploy on any VPS (Ubuntu) – Production Guide

নিচের গাইডটা Ubuntu VPS (DigitalOcean/Vultr/Hetzner/AWS) এ deploy করার জন্য। আপনি অন্য Linux ব্যবহার করলেও ধাপগুলো প্রায় একই।

### Quick auto setup (clone তারপর এক কমান্ড)

VPS এ আপনার repo clone করার পর নিচেরটা চালান:

```bash
bash scripts/vps-setup.sh
```

Optional (domain + SSL + env values) একসাথে:

```bash
export DOMAIN=yourdomain.com
export PORT=3000
export BASE_URL=https://yourdomain.com
export ENABLE_SSL=1
export GMAIL_USER=you@gmail.com
export GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"
bash scripts/vps-setup.sh
```

এই স্ক্রিপ্ট:
- Nginx + UFW সেট করে
- Node.js LTS ইনস্টল করে (না থাকলে)
- `npm ci` রান করে
- `.env` তৈরি করে (না থাকলে) এবং উপরের env দিলে সেট করে
- PM2 দিয়ে `server.js` রান করে এবং reboot এ auto-start সেট করে
- `DOMAIN` দিলে Nginx reverse proxy কনফিগার করে
- `ENABLE_SSL=1` দিলে Certbot দিয়ে HTTPS চালু করে

### 1) VPS প্রস্তুত করুন

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git nginx ufw
```

Firewall (recommended):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 2) Node.js ইনস্টল করুন

আপনার সার্ভারে Node.js LTS ইনস্টল করুন (NodeSource ব্যবহার করলে সহজ হয়):

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

### 3) প্রজেক্ট সার্ভারে আনুন

```bash
cd /var/www
sudo mkdir -p gmail-sender
sudo chown -R $USER:$USER /var/www/gmail-sender
git clone <YOUR_REPO_URL> /var/www/gmail-sender
cd /var/www/gmail-sender
npm ci
```

### 4) `.env` সেট করুন

`.env.example` দেখে সার্ভারে `.env` বানান:

```bash
cp .env.example .env
nano .env
```

Recommended values:

- `PORT=3000` (অথবা অন্য কোনো পোর্ট)
- `BASE_URL=https://yourdomain.com` (unsubscribe link ঠিক রাখতে)
- Gmail ব্যবহার করলে: `GMAIL_USER` + `GMAIL_APP_PASSWORD`

আপনি যদি ওয়েব UI থেকে SMTP সেট করেন, সেটি `data/smtp.json` এ সেভ হবে। Production এ চাইলে এটাও backup রাখুন।

### 5) PM2 দিয়ে সার্ভার রান করুন (recommended)

```bash
sudo npm i -g pm2
pm2 start server.js --name gmail-sender
pm2 save
pm2 startup
```

`pm2 startup` কমান্ড যেটা দেখাবে সেটা কপি করে রান করলে reboot এর পরেও সার্ভার auto start হবে।

### 6) Nginx Reverse Proxy (Domain সহ)

নিচের ফাইল বানান:

```bash
sudo nano /etc/nginx/sites-available/gmail-sender
```

Config (domain বদলাবেন):

```nginx
server {
  listen 80;
  server_name yourdomain.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

Enable + reload:

```bash
sudo ln -s /etc/nginx/sites-available/gmail-sender /etc/nginx/sites-enabled/gmail-sender
sudo nginx -t
sudo systemctl reload nginx
```

এখন `http://yourdomain.com` এ আপনার app ওপেন হবে।

### 7) HTTPS (Optional but recommended)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

Certbot auto-renew সাধারণত সেট করে দেয়।

### 8) Update / Redeploy

```bash
cd /var/www/gmail-sender
git pull
npm ci
pm2 restart gmail-sender
```

### Notes

- Gmail bulk sending এ limit থাকে। `BULK_DELAY_MS` বাড়ালে block হওয়ার সম্ভাবনা কমে।
- Attachment পাঠালে request বড় হয়, তাই server JSON limit বাড়ানো আছে। তবুও খুব বড় ফাইল পাঠাবেন না।
