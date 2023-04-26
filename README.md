# MGraph Web

This contains MGraph's web app, built in [Next.js](https://nextjs.org/) typescript and deployed through [Vercel](https://vercel.com/mgraph/mgraph-web).

## Development

First, configure your local environment from cloned dir (we install Vercel locally since we need to [override its use of an old typescript version](https://github.com/vercel/vercel/issues/8680)):

```bash
yarn --check-files
yarn vercel link
yarn vercel env pull # use local vercel to override use of old typescript -- see https://github.com/vercel/vercel/issues/8680
npx husky install # enable pre-commit hooks
```

Then, run the development server (clear cache before each build so snowflake-jdbc-proxy runs correctly):

```bash
rm -rf .vercel/cache/index && yarn vercel dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the current app.

## Deployment

Whatever's in `main` gets deployed to [app.mgraph.us](app.mgraph.us). Vercel automatically deploys preview builds (mgraph-xxxxxxxxx-mgraph.vercel.app, etc.) upon pull request.
