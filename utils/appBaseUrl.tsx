export const getBaseUrl: () => string = () => {
  return process.env.NEXT_PUBLIC_ENV === 'production'
    ? process.env.NEXT_PUBLIC_PROD_BASE_URL || ''
    : process.env.NEXT_PUBLIC_ENV === 'staging'
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'
}
