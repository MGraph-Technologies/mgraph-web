import crypto from 'crypto'
import CryptoJS from 'crypto-js'
import jwt from 'jsonwebtoken'

const databaseConnectionsCredentialsKey =
  process.env.DATABASE_CONNECTIONS_CREDENTIALS_KEY

export const decryptCredentials = (
  encryptedCredentials: string,
  organizationId: string,
  organizationCreatedAt: Date
): {
  region: string
  account: string
  username: string
  privateKeyString: string
  privateKeyPassphrase: string
} => {
  const decryptedCredentials = CryptoJS.AES.decrypt(
    encryptedCredentials,
    organizationId + organizationCreatedAt + databaseConnectionsCredentialsKey
  ).toString(CryptoJS.enc.Utf8)
  const decryptedCredentialsJson = JSON.parse(decryptedCredentials)
  return {
    region: decryptedCredentialsJson.region,
    account: decryptedCredentialsJson.account,
    username: decryptedCredentialsJson.username,
    privateKeyString: decryptedCredentialsJson.privateKeyString,
    privateKeyPassphrase: decryptedCredentialsJson.privateKeyPassphrase,
  }
}

export const makeToken = (
  account: string,
  username: string,
  privateKeyString: string,
  privateKeyPassphrase: string
): string => {
  const privateKeyObject = crypto.createPrivateKey({
    key: privateKeyString,
    format: 'pem',
    passphrase: privateKeyPassphrase,
  })
  const privateKey = privateKeyObject.export({ format: 'pem', type: 'pkcs8' })
  const publicKeyObject = crypto.createPublicKey({
    key: privateKey,
    format: 'pem',
  })
  const publicKey = publicKeyObject.export({ format: 'der', type: 'spki' })

  const publicKeyFingerprint =
    'SHA256:' + crypto.createHash('sha256').update(publicKey).digest('base64')
  const qualifiedUsername = account.toUpperCase() + '.' + username.toUpperCase()
  const signOptions = {
    iss: qualifiedUsername + '.' + publicKeyFingerprint,
    sub: qualifiedUsername,
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  }
  const token = jwt.sign(signOptions, privateKey, { algorithm: 'RS256' })
  return token
}
