import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'

    if (!token || token.length !== 64) {
      return NextResponse.redirect(`${appUrl}/definir-senha?error=invalid_token`)
    }

    return NextResponse.redirect(`${appUrl}/convite/${token}`)

  } catch (error) {
    console.error('[CONVITE] Erro geral:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'}/definir-senha?error=server_error`
    )
  }
}
