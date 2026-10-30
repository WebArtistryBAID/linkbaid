<div align="center">

# LinkBAID

A unified OAuth2 server for BAID's Seiue LMS and Feishu logins.

Used by WebArtistryBAID/[helium](https://github.com/WebArtistryBAID/helium),
WebArtistryBAID/[whale](https://github.com/WebArtistryBAID/whale),
WebArtistryBAID/[baid-speaker](https://github.com/WebArtistryBAID/baid-speaker), and other third-party services.

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-required-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)

[Overview](#overview) · [Development](#development) · [Production](#production) · [Environment Variables](#environment-variables) · [Contribution](#contribution) · [License](#license)

</div>

## Overview

## Development

To run in development:

1. Install Node.js and npm.
2. Copy `.env.example` to `.env`.
3. Run `npm install`.
4. Set up a PostgreSQL database and set `DATABASE_URL` in `.env`.
5. Set `HOSTED=http://localhost:3000`, `UPLOAD_ROOT=public/uploads`, and `UPLOAD_SERVE_PATH=uploads`.
6. Apply Prisma migrations and generate the client:

   ```sh
   prisma migrate deploy
   prisma generate
   ```
7. Fill the remaining environment variables.
8. Run `npm run dev` to start the development server.

### Database Migrations

* After pulling someone else's migrations, run `prisma migrate deploy`, then `prisma generate`.
* To create your own migration, edit `prisma/schema.prisma` and run `prisma migrate dev --name describe_change`. Commit
  the schema and the entire `prisma/migrations/` directory together.
* On production, run `prisma migrate deploy`, then `prisma generate` before building and restarting Project Whale.
  **Monitor the messages carefully, do NOT reset the database!**

## Production

To run in production:

1. Install Node.js and npm.
2. Copy `.env.example` to `.env`.
3. Run `npm install`.
4. Set up a PostgreSQL database and set `DATABASE_URL` in `.env`.
5. For a fresh database, run `prisma migrate deploy`.
6. Run `prisma generate`.
7. Fill the remaining environmental variables.
8. Run `npm run build` to build the production server.
9. Using `pm2`, run `pm2 start npm --name linkbaid -- run start` to start the production server. You can also use
   `pm2 save` to save the process list and `pm2 startup` to configure it to start on boot.
10. LinkBAID runs on port 52321 by default.
11. Create a reverse proxy with Nginx as appropriate such that Nginx handles HTTPS and serves static files. An example
    Nginx configuration is shown below. HTTPS can usually be configured with Let's Encrypt.

```nginx
server {
    listen 443 ssl;
    server_name link.example.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    client_max_body_size 11M;

    location ^~ /uploads/ {
        alias /home/web/linkbaid/uploads/;  # By setting up Nginx to serve files from /uploads/, we must set `UPLOAD_SERVE_PATH` to `/uploads` (users access uploaded files on `https://.../uploads/...`) and `UPLOAD_PATH` to `uploads` (uploaded files are saved to `/home/web/whale/uploads/`)
        autoindex off;
        add_header X-Content-Type-Options nosniff always;
        try_files $uri =404;
    }

    location / {
        proxy_pass http://localhost:52321;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Environment Variables

| Name                | Description                                                                              |
|---------------------|------------------------------------------------------------------------------------------|
| `DATABASE_URL`      | The database URL to use.                                                                 |
| `JWT_SECRET`        | The JWT secret key to use. You can generate one with `openssl rand -hex 32`.             |
| `SEIUE_CLIENT_ID`   | The client ID received from Seiue LMS for authentication.                                |
| `FEISHU_APP_ID`     | The app ID received from Feishu for authentication.                                      |
| `FEISHU_APP_SECRET` | The app secret received from Feishu for authentication.                                  |
| `HOSTED`            | The location where OneLogin is hosted. No trailing slashes.                              |
| `UPLOAD_ROOT`       | The directory where uploaded files are stored. In development, this is `public/uploads`. |
| `UPLOAD_SERVE_PATH` | The path where uploaded files are served. In development, this is `uploads`.             |
| `BOTTOM_TEXT`       | In case you need this.                                                                   |

* Run `npm run dev`.

## Contribution

To contribute, simply open a pull request.

## License

```
    LinkBAID is a unified OAuth2 server for BAID's Seiue LMS and Feishu.
    Copyright (C) 2026  Team WebArtistry

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
```
