import CryptoJS from 'crypto-js'

const databaseConnectionsCredentialsKey =
  process.env.DATABASE_CONNECTIONS_CREDENTIALS_KEY

export type SnowflakeCredentials = {
  region: string
  account: string
  username: string
  password: string
  dbtProxyServerUrl: string
}

export const decryptCredentials = (
  encryptedCredentials: string,
  organizationId: string,
  organizationCreatedAt: string
): SnowflakeCredentials => {
  const decryptedCredentials = CryptoJS.AES.decrypt(
    encryptedCredentials,
    organizationId + organizationCreatedAt + databaseConnectionsCredentialsKey
  ).toString(CryptoJS.enc.Utf8)
  const decryptedCredentialsJson = JSON.parse(
    decryptedCredentials
  ) as SnowflakeCredentials
  return {
    region: decryptedCredentialsJson.region,
    account: decryptedCredentialsJson.account,
    username: decryptedCredentialsJson.username,
    password: decryptedCredentialsJson.password,
    dbtProxyServerUrl: decryptedCredentialsJson.dbtProxyServerUrl,
  }
}

export const encryptCredentials = (
  credentials: SnowflakeCredentials,
  organizationId: string,
  organizationCreatedAt: string
): string => {
  return CryptoJS.AES.encrypt(
    JSON.stringify(credentials),
    organizationId + organizationCreatedAt + databaseConnectionsCredentialsKey
  ).toString()
}

export const formJdbcUrl = (credentials: SnowflakeCredentials): string => {
  const baseUrl: string =
    credentials.dbtProxyServerUrl ||
    `https://${credentials.account}.${credentials.region}.snowflakecomputing.com`
  return 'jdbc:snowflake://' + baseUrl.replace('https://', '')
}
