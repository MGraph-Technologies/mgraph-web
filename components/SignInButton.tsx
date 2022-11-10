import Image from 'next/image'
import React, { FunctionComponent, useState } from 'react'

import { supabase } from '../utils/supabaseClient'

const SignInButton: FunctionComponent = () => {
  const GOOGLE_SIGN_IN_BTN_IMG_SRC_DEFAULT =
    '/btn_google_signin_dark_normal_web@2x.png'
  const GOOGLE_SIGN_IN_BTN_IMG_SRC_HOVER =
    '/btn_google_signin_dark_focus_web@2x.png'
  const GOOGLE_SIGN_IN_BTN_IMG_SRC_CLICK =
    '/btn_google_signin_dark_pressed_web@2x.png'
  const [buttonImgSrc, setButtonImgSrc] = useState(
    GOOGLE_SIGN_IN_BTN_IMG_SRC_DEFAULT
  )

  const handleSignIn = async () => {
    try {
      setButtonImgSrc(GOOGLE_SIGN_IN_BTN_IMG_SRC_CLICK)
      const { error } = await supabase.auth.signIn({
        provider: 'google',
      })
      if (error) throw error
    } catch (error: unknown) {
      console.error(error)
    } finally {
      setButtonImgSrc(GOOGLE_SIGN_IN_BTN_IMG_SRC_DEFAULT)
    }
  }
  return (
    <div>
      <Image
        src={buttonImgSrc}
        alt="Sign in with Google"
        width={200}
        height={50}
        onClick={handleSignIn}
        onMouseEnter={() => {
          setButtonImgSrc(GOOGLE_SIGN_IN_BTN_IMG_SRC_HOVER)
        }}
        onMouseLeave={() => {
          setButtonImgSrc(GOOGLE_SIGN_IN_BTN_IMG_SRC_DEFAULT)
        }}
        loading="eager"
      />
    </div>
  )
}

export default SignInButton
