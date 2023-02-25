import { Ring } from '@uiball/loaders'
import { FunctionComponent } from 'react'

import { useAuth } from 'contexts/auth'
import styles from 'styles/LoadingWheelOverlay.module.css'

type LoadingWheelOverlayProps = {
  backgroundOpacity?: number
}
const LoadingWheelOverlay: FunctionComponent<LoadingWheelOverlayProps> = ({
  backgroundOpacity = 0.5,
}) => {
  const { userOnMobile } = useAuth()
  return (
    <div
      className={styles.loading_wheel_container}
      style={{ backgroundColor: `rgba(255, 255, 255, ${backgroundOpacity})` }}
    >
      {userOnMobile ? (
        <>Loading...</>
      ) : (
        <Ring size={80} speed={2} lineWeight={5} color="#5F62EC" />
      )}
    </div>
  )
}

export default LoadingWheelOverlay
