import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { initializeApp } from 'firebase/app'
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signOut,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_AUTH_DOMAIN',
  projectId: 'YOUR_PROJECT_ID',
  appId: 'YOUR_APP_ID',
}

const firebaseApp = initializeApp(firebaseConfig)
const auth = getAuth(firebaseApp)
const initialSquares = Array(9).fill('')

function calculateWinner(squares) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ]

  for (const [a, b, c] of lines) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a]
    }
  }

  return null
}

function App() {
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [squares, setSquares] = useState(initialSquares)
  const [isXNext, setIsXNext] = useState(true)
  const [statusMessage, setStatusMessage] = useState('Ready to play!')
  const [voices, setVoices] = useState([])

  const winner = useMemo(() => calculateWinner(squares), [squares])
  const isDraw = !winner && squares.every(Boolean)

  useEffect(() => {
    const updateVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices()
      setVoices(availableVoices)
    }

    updateVoices()
    window.speechSynthesis.onvoiceschanged = updateVoices

    return () => {
      window.speechSynthesis.onvoiceschanged = null
    }
  }, [])

  useEffect(() => {
    if (winner) {
      const winMessage = `Congratulations! Player ${winner} wins the match.`
      setStatusMessage(winMessage)
      announceResult(winMessage, winner === 'X' ? 'winnerX' : 'winnerO')
      return
    }

    if (isDraw) {
      const drawMessage = "It's a draw! Great defense by both players."
      setStatusMessage(drawMessage)
      announceResult(drawMessage, 'draw')
      return
    }

    setStatusMessage(`Next turn: ${isXNext ? 'X' : 'O'}`)
  }, [winner, isDraw, isXNext])

  function selectVoice(type) {
    if (!voices.length) {
      return null
    }

    const searchOrder = {
      winnerX: ['male', 'english', 'en'],
      winnerO: ['female', 'english', 'en'],
      draw: ['english', 'en'],
    }

    const desired = searchOrder[type] || ['english', 'en']
    const match = voices.find((voice) =>
      desired.every((term) =>
        voice.name.toLowerCase().includes(term) || voice.lang.toLowerCase().includes(term),
      ),
    )

    if (match) {
      return match
    }

    if (type === 'winnerX') {
      return voices.find((voice) => /male/i.test(voice.name)) || voices[0]
    }

    if (type === 'winnerO') {
      return voices.find((voice) => /female/i.test(voice.name)) || voices[0]
    }

    return voices[0]
  }

  function announceResult(message, type) {
    if (!('speechSynthesis' in window)) {
      return
    }

    const utterance = new SpeechSynthesisUtterance(message)
    utterance.volume = 1
    utterance.rate = type === 'winnerO' ? 0.96 : 1.05
    utterance.pitch = type === 'winnerO' ? 1.2 : type === 'winnerX' ? 1.0 : 0.95
    utterance.voice = selectVoice(type)

    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  const handleSquareClick = (index) => {
    if (winner || squares[index]) {
      return
    }

    const nextSquares = [...squares]
    nextSquares[index] = isXNext ? 'X' : 'O'
    setSquares(nextSquares)
    setIsXNext((prev) => !prev)
  }

  const resetGame = () => {
    setSquares(initialSquares)
    setIsXNext(true)
    setStatusMessage('Game reset. Ready for a new match!')
    window.speechSynthesis.cancel()
  }

  const handleLocalLogin = (event) => {
    event.preventDefault()

    if (!email.trim() || !password.trim()) {
      setLoginError('Please enter both email and password.')
      return
    }

    setUser({
      displayName: email.split('@')[0] || 'Player',
      email,
    })
    setLoginError('')
  }

  const handleSocialLogin = async (providerName) => {
    setLoginError('')

    try {
      const provider =
        providerName === 'google'
          ? new GoogleAuthProvider()
          : new FacebookAuthProvider()

      if (providerName === 'facebook') {
        provider.addScope('email')
      }

      const result = await signInWithPopup(auth, provider)
      const signedInUser = result.user

      setUser({
        displayName: signedInUser.displayName || signedInUser.email || providerName,
        email: signedInUser.email,
        photoURL: signedInUser.photoURL,
      })
    } catch (error) {
      console.warn('Social login fallback:', error)
      setLoginError(
        'Social login could not complete. Signed in as a guest account instead.',
      )
      setUser({
        displayName: `${providerName.charAt(0).toUpperCase()}${providerName.slice(1)} Guest`,
        email: `${providerName}@guest.ticgame`,
      })
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.warn('Firebase sign out failed:', error)
    }

    setUser(null)
    setEmail('')
    setPassword('')
    setLoginError('')
    resetGame()
  }

  return (
    <div className="app-container">
      {user ? (
        <div className="game-shell">
          <div className="game-header">
            <div className="title-box">
              <h1>TicGame Arena</h1>
              <p className="subtitle">
                Welcome, {user.displayName || user.email}! Play with voice-enabled results.
              </p>
            </div>
            <div className="header-actions">
              <div className="user-profile">
                <span className="badge">Signed in as {user.displayName || 'Guest'}</span>
              </div>
              <button className="button-secondary logout-button" onClick={handleLogout}>
                Logout
              </button>
              <button className="button-primary" onClick={resetGame}>
                Restart
              </button>
            </div>
          </div>

          <div className="status-box">{statusMessage}</div>

          <div className="board">
            {squares.map((value, index) => (
              <button
                key={index}
                type="button"
                className="square"
                disabled={Boolean(value) || Boolean(winner)}
                onClick={() => handleSquareClick(index)}
              >
                {value}
              </button>
            ))}
          </div>

          <p className="hint">
            {winner
              ? `Winner voice is ${winner === 'X' ? 'different for X' : 'different for O'}!`
              : isDraw
              ? 'Draw voice announced for the tie.'
              : 'Click a square to play the next move.'}
          </p>
        </div>
      ) : (
        <div className="auth-shell">
          <div className="auth-card">
            <div className="title-box">
              <h1>Login to TicGame</h1>
              <p className="subtitle">
                Use email/password or continue with Google and Facebook.
              </p>
            </div>

            <form className="login-form" onSubmit={handleLocalLogin}>
              <div className="form-group">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div className="form-group">
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                />
              </div>

              {loginError && <div className="error-box">{loginError}</div>}
              <button className="button-primary" type="submit">
                Login
              </button>

              <p className="hint">
                If social login is not configured yet, the app will still sign you in as a guest.
              </p>
            </form>

            <div className="social-login">
              <button
                type="button"
                className="button-google"
                onClick={() => handleSocialLogin('google')}
              >
                Continue with Google
              </button>
              <button
                type="button"
                className="button-facebook"
                onClick={() => handleSocialLogin('facebook')}
              >
                Continue with Facebook
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
