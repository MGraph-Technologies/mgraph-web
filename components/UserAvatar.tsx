import Image from 'next/image'
import { Avatar } from 'primereact/avatar'
import { FunctionComponent, MouseEventHandler } from 'react'

export type User = {
  name: string
  email: string
  avatarUrl: string
}
type UserAvatarProps = {
  user: User
  onClick?: MouseEventHandler<HTMLImageElement> | undefined
}
const UserAvatar: FunctionComponent<UserAvatarProps> = ({ user, onClick }) => {
  const avatarChar = user.name ? user.name[0] : user.email[0]
  return user.avatarUrl ? (
    <Image
      src={user.avatarUrl}
      alt="User Avatar"
      height={32}
      width={32}
      onClick={onClick}
      // round
      style={{ borderRadius: '50%' }}
    />
  ) : (
    <Avatar
      id="account-menu"
      label={avatarChar}
      onClick={onClick}
      // shape="circle" doesn't work with char
      style={{ borderRadius: '50%' }}
    />
  )
}

export default UserAvatar
