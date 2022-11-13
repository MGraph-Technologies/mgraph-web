export const getBaseUrl: () => string = () => {
  return process.env.VERCEL_ENV === 'production'
    ? 'https://app.mgraph.us'
    : process.env.VERCEL_ENV === 'preview'
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'
}
