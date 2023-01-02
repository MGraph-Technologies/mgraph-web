export const getBaseUrl: () => string = () => {
  return process.env.NEXT_PUBLIC_ENV === 'production'
    ? 'https://app.mgraph.us'
    : process.env.NEXT_PUBLIC_ENV === 'staging'
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'
}
