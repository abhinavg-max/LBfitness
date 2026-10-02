# LB FITNESS – website, member panel and admin panel

Runs on your own computer with a local **PostgreSQL** database and **Cloudinary** for member photos.

What is inside
- `public/index.html` – the whole website (home page, member panel, admin panel)
- `server.js` – the server (login, members, payments, photo upload)
- `schema.sql` – the database tables (created automatically when the server starts)
- `.env.example` – settings you copy to `.env` and fill in

How it works
- Members log in with their **mobile number only**. The admin must add them first.
- The admin signs in on the **Admin** tab with the mobile number and password you set in `.env`.
- Member photos go to Cloudinary as **private** images. Only the admin panel receives them (as signed links). The member panel never gets a photo.
- No online payments. The admin records every desk payment.

---------------------------------------------------------------------

## Step 1 – Install the programs

1. **Node.js 18 or newer** – https://nodejs.org (choose LTS). Check: open a terminal and run `node -v`.
2. **PostgreSQL** – https://www.postgresql.org/download/
   - During install, set a password for the user `postgres`. **Write it down.**
   - Keep the default port `5432`.

## Step 2 – Create the database

Windows: open **SQL Shell (psql)** from the Start menu, press Enter through the questions, type the `postgres` password, then run:

    CREATE DATABASE lbfitness;

Mac / Linux: in a terminal run:

    createdb -U postgres lbfitness

(or use pgAdmin: right-click Databases > Create > Database > name it `lbfitness`).

You do **not** need to create tables. The server creates them from `schema.sql` on first start.

## Step 3 – Set up Cloudinary (photo storage)

1. Go to https://cloudinary.com and click **Sign up for free**. Verify your email.
2. Log in. Open the **Dashboard** (or **Settings > API Keys**).
3. Copy these three values:
   - **Cloud name**
   - **API Key**
   - **API Secret** (click the eye icon to show it)
4. Keep the API Secret private. Do not share it or put it in the website files.

No upload preset is needed. The server uploads photos into the folder `lb-fitness/members` as private images.

## Step 4 – Fill in the settings

1. In this folder, copy `.env.example` and name the copy `.env`.
2. Open `.env` in Notepad and fill in:

       DATABASE_URL=postgres://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/lbfitness
       CLOUDINARY_CLOUD_NAME=your cloud name
       CLOUDINARY_API_KEY=your api key
       CLOUDINARY_API_SECRET=your api secret
       ADMIN_MOBILE=the admin's mobile number (10 digits)
       ADMIN_PASSWORD=a strong password for the admin
       JWT_SECRET=any long random text (30+ characters)

   If your postgres password has symbols like `@` or `#`, replace each with its code (`@` = `%40`, `#` = `%23`).

## Step 5 – Start the website

In a terminal, inside this folder:

    npm install
    npm start

You should see `LB FITNESS running at http://localhost:3000`. Open that address in your browser.

## Step 6 – First use

1. Click **Log in**, choose the **Admin** tab, enter `ADMIN_MOBILE` and `ADMIN_PASSWORD`.
2. Dashboard > **+ Add member** to create the first member (photo optional).
3. Log out. Click **Log in** > **Member**, type that member's mobile number. Their panel opens.

To use it on other phones in the gym (same Wi-Fi), find the computer's IP address (Windows: `ipconfig`) and open `http://THAT-IP:3000`. Allow Node.js through the firewall if asked.

---------------------------------------------------------------------

## Backup (important)

Back up the database regularly:

    pg_dump -U postgres lbfitness > backup.sql

Restore on a new computer:

    createdb -U postgres lbfitness
    psql -U postgres lbfitness < backup.sql

## Troubleshooting

- **"password authentication failed"** – the password in `DATABASE_URL` is wrong.
- **"ECONNREFUSED" / "Could not connect to the database"** – PostgreSQL is not running. Start the PostgreSQL service.
- **"database lbfitness does not exist"** – repeat Step 2.
- **Photo upload fails / "Invalid Signature"** – re-copy the Cloudinary API Secret into `.env` with no spaces, then restart the server.
- **"Missing ... in your .env file"** – a setting in `.env` is empty.
- **Port already in use** – change `PORT` in `.env`.

## Before putting it on the internet

This setup is meant for use on your own computer or gym network. Before a public website: use HTTPS (set the cookie `secure: true` in `server.js`), choose a strong admin password, host PostgreSQL somewhere safe with backups, and keep `.env` private.
