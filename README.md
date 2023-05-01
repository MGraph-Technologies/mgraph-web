# MGraph Web

![MGraph Logo](https://qfajvvqhnbvjgvgesooj.supabase.co/storage/v1/object/public/public/brand/mgraph-logo-light.svg)

MGraph is a single dashboard for your entire organization, encompassing metrics, goals, teams, and work. With it, you can:

- Define and visualize metrics and the relationships between them
- Establish and track metric goals
- Establish and track metric monitoring rules
- Add comments and contextualizing artifacts (e.g., project trackers, strategy docs)

Metrics can be sourced directly from a data warehouse, from dbt metrics, or from embeddings of other BI tools' charts/dashboards.

Here's a lil' video runthrough:

[![MGraph Demo Video](https://img.youtube.com/vi/kTi3DPXQVtw/0.jpg)](https://www.youtube.com/watch?v=kTi3DPXQVtw)

MGraph currently supports Google auth and Snowflake data warehouses.

## Installation

MGraph is self-hosted via Supabase and Vercel. Follow the instructions below to get up and running (expected time: 30-60 minutes).

### Supabase

MGraph uses [Supabase](https://supabase.com/) for auth and data storage. At a minimum, you'll need one Supabase project to underpin your production MGraph environment. If you intend to use Vercel's development and preview environments (see below), you'll also want a separate Supabase project for each of those.

For each environment:

1. Create a Supabase project
2. Run `supabase_pg_init.sql` to initialize the project's postgres database
3. [Configure login with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)

### Vercel

MGraph uses [Vercel](https://vercel.com/) for app and API hosting. Within a Vercel project, [code is deployed](https://vercel.com/docs/concepts/deployments/builds) across three environments as changes are made: development, preview, and production (each with its own URL and environment variables). At minimum, you'll use the production environment to host the instance of MGraph that your organization uses day-to-day. If you want to develop MGraph (see below), you'll additionally use the development and staging environments (if you don't, they'll still deploy but won't work but won't be used).

To configure Vercel:

1. [Create a Next.js Vercel project](https://vercel.com/docs/concepts/projects/overview#creating-a-project) based on this repo or a fork of it
2. Add the following [environment variables](https://vercel.com/docs/concepts/projects/environment-variables), all case sensitive, to each in-use environment:
   1. `DATABASE_CONNECTIONS_CREDENTIALS_KEY` - a random string of your choosing used to encrypt/decrypt sensitive database credentials stored in Supabase
   2. `NEXT_PUBLIC_ENV` - set to `development` for development, `staging` for preview (_note the difference_), and `production` for production
   3. `NEXT_PUBLIC_PROD_BASE_URL` - where your production instance of MGraph is hosted (e.g., `https://mgraph.mycompany.com`; it should be the same value for all environments)
   4. `NEXT_PUBLIC_SUPABASE_ANON_KEY` - the [anon key](https://supabase.com/docs/guides/api/api-keys#the-anon-key) of the Supabase project corresponding to an environment
   5. `NEXT_PUBLIC_SUPABASE_URL` - the URL of the Supabase project corresponding to an environment (e.g., `https://xxxxxxxxxxxxxxxxxxxx.supabase.co`)
   6. `SUPABASE_SERVICE_ROLE_KEY` - the [service role key](https://supabase.com/docs/guides/api/api-keys#the-servicerole-key) of the Supabase project corresponding to an environment

### GitHub (optional, but recommended)

If configured, MGraph can sync metric definitions from a dbt project via a [GitHub app](https://docs.github.com/en/apps). For each environment where you want syncing:

1. [Create a new GitHub app](https://docs.github.com/en/apps/creating-github-apps/setting-up-a-github-app/creating-a-github-app) for your organization with the following permissions:
   1. `Contents` - `read`
   2. `Metadata` - `read`
   3. `Pull requests` - `read`
2. Set its `Setup URL` to `<your-prod-base-url>/callbacks/mgraph-dbt-sync` (e.g., `https://mgraph.mycompany.com/callbacks/mgraph-dbt-sync`)
3. Activate its webhook, setting `Webhook URL` to `<your-prod-base-url>/api/v1/webhooks/github` (e.g., `https://mgraph.mycompany.com/api/v1/webhooks/github`) and `Webhook secret` to a value of your choosing
4. Ensure `Enable SSL verification` is checked
5. Generate and download a private key for the app
6. Add the following environment variables (all case sensitive) to your Vercel project:
   1. `GITHUB_WEBHOOK_SECRET` - the value you set for `Webhook secret` above
   2. `MGRAPH_DBT_SYNC_GITHUB_APP_ID` - your GitHub app's ID
   3. `MGRAPH_DBT_SYNC_GITHUB_APP_PRIVATE_KEY` - your GitHub app's private key (copy/paste the contents of the downloaded private key file exactly as-is)
   4. `NEXT_PUBLIC_MGRAPH_DBT_SYNC_GITHUB_APP_URL` - your GitHub app's URL (e.g., `https://github.com/apps/yourcompany-mgraph-dbt-sync`)

### Sendgrid (optional, but recommended)

If configured, MGraph can send email notifications via [Sendgrid](https://sendgrid.com/). For each environment where you want notifications:

1. Create an [API key](https://docs.sendgrid.com/ui/account-and-settings/api-keys) with `Mail Send` permissions
   1. Note that you'll also need to have verified [your domain](https://docs.sendgrid.com/ui/account-and-settings/how-to-set-up-domain-authentication) and [a sender address](https://docs.sendgrid.com/ui/sending-email/sender-verification)
2. Create a [dynamic template](https://docs.sendgrid.com/ui/sending-email/how-to-send-an-email-with-dynamic-templates#design-a-dynamic-template) for notification emails (recommendation: use `sendgrid_email_template.html`, at least as a starting point)
3. Add the following environment variables (all case sensitive) to your Vercel project:
   1. `NEXT_PUBLIC_EMAIL_FROM_ADDRESS` - the verified email address you want notifications to come from
   2. `NEXT_PUBLIC_EMAIL_SENDGRID_TEMPLATE_ID` - the ID of the dynamic template you created above
   3. `SENDGRID_API_KEY` - the API key you created above

### Segment (optional)

If configured, MGraph can send analytics events to [Segment](https://segment.com/). For each environment where you want analytics:

1. Create an [Analytics.js source](https://segment.com/docs/connections/sources/catalog/libraries/website/javascript/quickstart/#step-1-create-a-source)
2. Add the following environment variables (all case sensitive) to your Vercel project:
   1. `NEXT_PUBLIC_SEGMENT_WRITE_KEY` - your Segment source's write key

### Sentry (optional)

If configured, MGraph can use [Sentry](https://sentry.io/) for observability. If you'd like to use Sentry:

1. [Create a Sentry project](https://docs.sentry.io/product/sentry-basics/integrate-frontend/create-new-project/) for MGraph
2. Link it to your Vercel project
3. (Environment variables will automatically be established, and Sentry will automatically handle environment parsing)

## Usage

You can access your MGraph via the URL you've configured in Vercel. For much more information on how to use it, see the [MGraph Runbook](https://docs.google.com/document/d/1vLgQMqeKV6cVLzgDLUDxpkXwzDjXnSLsgMDCxY2SxQc/edit?usp=sharing).

## Development

### Local setup

You can initialize your local environment with the following (we install Vercel locally since we need to [override its use of an old typescript version](https://github.com/vercel/vercel/issues/8680)):

```bash
yarn --check-files
yarn vercel link
yarn vercel env pull
npx husky install # enable pre-commit hooks
```

Then run the development server (clear cache before each build so snowflake-jdbc-proxy runs correctly):

```bash
rm -rf .vercel/cache/index && yarn vercel dev
```

### Testing

Changes must clear lint and e2e testing github actions before being merged. You can run these locally with:

```bash
yarn run lint
yarn run cy:run
```

### Architecture

At a high level, MGraph's app architecture consists of:

1. A root landing/login page
2. A `/[organizationName]` `Workspace` containing
   1. The `GraphViewer`
   2. The `GraphTable`
   3. `pages/[organizationName]/nodes/[nodeId]` `NodeDetail` pages
   4. `pages/[organizationName]/...` settings pages

At a high level, MGraph's data model consists of:

1. `organizations`, `users`, `organization_members`, and `roles`
2. `nodes` and `edges` (the graph)
3. `database_connections`, `database_queries`, `refresh_jobs`, and `refresh_job_runs`
4. `goals`
5. `monitoring_rules` and `monitoring_rule_evaluations`
6. `comments`

MGraph relies on Supabase's SDK and row-level security as much as possible for data access, and supplementally uses Next API routes for more complex operations.

[Here's](https://www.figma.com/file/gSnbPoxnVDUi3hRcpwynx5/MGraph-Architecture?node-id=0-1&t=8qwyu3LdUzB5q2jW-11) a high-level diagram of a classical MGraph deployment.

### Priority contribution areas

1. Adding support for new auth methods (e.g., Microsoft)
2. Adding support for new data sources (e.g., BigQuery)
3. Graph version control
4. Graph filtering / search
5. Metric annotations

## Contact

Please use Github issues for bugs and feature requests.

## License

This project is licensed under the terms of the MIT license. See [LICENSE](LICENSE).

## Acknowledgements

MGraph was originally developed by [Rob Dearborn](https://robdearborn.com/) and [Emily Eckert](https://www.linkedin.com/in/embot/) in 2022.
