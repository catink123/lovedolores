import { Suspense, useState, useEffect, useRef } from 'react'
import './App.css'
import { Canvas, useThree } from '@react-three/fiber'
import { hapticFeedback, useSignal, viewport } from '@tma.js/sdk-react'
import { Heart } from './Heart'
import { PerspectiveCamera, Sparkles, useProgress } from '@react-three/drei'
import { RotatingLight } from './RotatingLight'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { SlotMachine } from './SlotMachine'
import * as THREE from 'three'
import gsap from 'gsap'

const PRIZES: Record<number, string> = {
  0: "50 бунов 💸",
  1: "Любая штука с вебе 🎁",
  2: "Массажик 💆‍♀️",
  3: "Поход в Милу 🗺️",
  4: "100 бунов 🤑",
  5: "Что захочется ✨",
  6: "Любой парфюм 👀",
  7: "Любая штука из любого магазина 😍"
}

function FixedWidthCamera({ position, defaultFov = 45 }: { position: [number, number, number], defaultFov?: number }) {
  const { size, camera } = useThree()
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      const aspect = size.width / size.height
      if (aspect < 1) {
        const hFovRad = THREE.MathUtils.degToRad(defaultFov)
        const vFovRad = 2 * Math.atan(Math.tan(hFovRad / 2) / aspect)
        camera.fov = THREE.MathUtils.radToDeg(vFovRad)
      } else {
        camera.fov = defaultFov
      }
      camera.updateProjectionMatrix()
    }
  }, [size, camera, defaultFov])
  return <PerspectiveCamera makeDefault position={position} />
}

type AppPhase = 'loading' | 'question' | 'assembling' | 'ready_for_slots' | 'slots' | 'show_prizes_anim' | 'show_prizes_done'

function App() {
  const viewportSafeArea = useSignal(viewport.contentSafeAreaInsets)

  const [phase, setPhase] = useState<AppPhase>('loading')

  const [spinsLeft, setSpinsLeft] = useState(20)
  const [wonFaces, setWonFaces] = useState<number[]>([])

  const [toastData, setToastData] = useState<{ title: string, message: string, isFinal?: boolean }>({ title: "", message: "" })
  const [showToast, setShowToast] = useState(false)

  const [noCount, setNoCount] = useState(0)

  const { progress } = useProgress()

  useEffect(() => {
    if (progress === 100 && phase === 'loading') {
      const timer = setTimeout(() => setPhase('question'), 500)
      return () => clearTimeout(timer)
    }
    
    // Safety Net: If the browser hangs on 99% for more than 30 seconds, force it to start
    const fallbackTimer = setTimeout(() => {
      if (phase === 'loading') setPhase('question')
    }, 30000)
    return () => clearTimeout(fallbackTimer)
  }, [progress, phase])


  const getNoButtonText = () => {
    const phrases = [
      "Нееееет", "Ты уверена?", "Тооочно уверена?", "Подумай!", "Еще раз", 
      "Прям точно?", "Ну пожалуйста!", "Это окончательный ответ?", 
      "Капец 💔"
    ]
    return phrases[Math.min(noCount, phrases.length - 1)]
  }

  const heartWrapperRef = useRef<THREE.Group>(null!)
  const slotsWrapperRef = useRef<THREE.Group>(null!)

  useEffect(() => {
    if (phase === 'slots') {
      gsap.to(heartWrapperRef.current.scale, { x: 0.25, y: 0.25, z: 0.25, duration: 2.2, ease: "back.inOut(1.2)" })
      gsap.to(heartWrapperRef.current.position, { x: 0, y: 1.5, z: 3, duration: 2.2, ease: "power3.inOut" })
      gsap.to(heartWrapperRef.current.rotation, { y: Math.PI * 2, duration: 2.2, ease: "power2.inOut" })

      gsap.set(slotsWrapperRef.current.position, { x: 0, y: -10, z: 2 })
      gsap.set(slotsWrapperRef.current.rotation, { x: -Math.PI / 4, y: Math.PI * 4, z: 0 })

      gsap.to(slotsWrapperRef.current.position, { x: 0, y: -2.1, z: 3, duration: 2.5, ease: "back.out(0.8)", delay: 0.8 })
      gsap.to(slotsWrapperRef.current.rotation, { x: 0, y: 0, z: 0, duration: 2.5, ease: "power3.out", delay: 0.8 })
    }

    if (phase === 'show_prizes_anim') {
      gsap.to(slotsWrapperRef.current.position, { x: 0, y: -1.5, z: 0, duration: 1.5, ease: "power2.inOut" })
      gsap.to(slotsWrapperRef.current.rotation, { x: 0, y: -Math.PI / 4, z: 0, duration: 1.5, ease: "power2.inOut" })
      gsap.to(slotsWrapperRef.current.scale, {
        x: 0.65, y: 0.65, z: 0.65, duration: 1.5, ease: "power2.inOut",
        onComplete: () => setPhase('show_prizes_done')
      })

      gsap.to(heartWrapperRef.current.rotation, { y: Math.PI * 4 + (-Math.PI / 4), duration: 2.2, ease: "power2.inOut" })
      gsap.to(heartWrapperRef.current.position, { x: 0.25, y: 1, z: 0, duration: 1.5, ease: "power2.inOut" })
    }
  }, [phase])

  const handleStartAssembly = () => {
    setPhase('assembling')
    try { hapticFeedback.impactOccurred('medium') } catch (e) { }
    setTimeout(() => { setPhase('ready_for_slots') }, 5000)
  }

  const handleSpinComplete = (results: [number, number, number]) => {
    const isWin = results[0] === results[1] && results[1] === results[2]

    if (isWin) {
      const face = results[0]
      const newWonFaces = [...wonFaces, face]
      setWonFaces(newWonFaces)

      if (newWonFaces.length >= 6) {
        setToastData({ title: "Легенда! 🏆", message: "Ты выиграла все 6 призов!", isFinal: true })
      } else {
        setToastData({ title: "Победа! 🎉", message: `Ты выиграла "${PRIZES[face]}"!` })
      }
      setShowToast(true) 
      try { hapticFeedback.notificationOccurred('success') } catch (e) { }
    } else {
      setSpinsLeft(prev => {
        if (prev === 0) {
          setToastData({ title: "Спины кончились!", message: "Но потому что я тебя люблю, возьми еще несколько" })
          setShowToast(true) 
          try { hapticFeedback.notificationOccurred('warning') } catch (e) { }
        }
        return prev
      })
    }
  }

  const addSpins = () => {
    setSpinsLeft(prev => prev + 10)
    try { hapticFeedback.impactOccurred('rigid') } catch (e) { }
  }

  const isGameLocked = wonFaces.length >= 8

  return (
    <div className="App" style={{ height: '100dvh', position: 'relative', overflow: 'hidden', width: '100%' }}>
      {/* --- THE 3D WORLD --- */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <Canvas gl={{ toneMappingExposure: 0.15 }}>
          <ambientLight intensity={1} color="#ffffffff" />
          <RotatingLight />
          <directionalLight position={[3, 0, 2]} intensity={0.5} color="#ffffff">
            <object3D attach="target" position={[0, 0, 0]} />
          </directionalLight>
          <spotLight position={[0, 0, -10]} intensity={10} color="#ffffff" distance={20} angle={1} penumbra={1}>
            <object3D attach="target" position={[0, 0, 0]} />
          </spotLight>

          <Suspense fallback={null}>
            <group ref={heartWrapperRef} position={[0, 0, -10]}>
              <Heart isAssembling={phase !== 'loading' && phase !== 'question'} />
            </group>

            <group ref={slotsWrapperRef} position={[0, 50, 0]}>
              <SlotMachine
                canSpin={spinsLeft > 0 && !showToast && !isGameLocked}
                wonFaces={wonFaces} 
                onSpinStart={() => setSpinsLeft(prev => prev - 1)}
                onSpinComplete={handleSpinComplete}
              />
            </group>
          </Suspense>

          <Sparkles
            count={100}
            scale={6}
            size={isGameLocked ? 8 : 4} 
            speed={isGameLocked ? 2.0 : 0.4}
            opacity={isGameLocked ? 0.8 : 0.1}
            color="#ffc9d3"
            noise={100}
          />
          <FixedWidthCamera position={[0, 0, 10]} defaultFov={20} />

          <EffectComposer enableNormalPass={false}>
            <Bloom luminanceThreshold={0.5} opacity={0.35} intensity={0.5} mipmapBlur={true} resolutionScale={0.5} />
          </EffectComposer>
        </Canvas>
      </div>

      {/* --- THE UI OVERLAY --- */}
      <div
        className="ui-overlay"
        style={{
          paddingBottom: viewportSafeArea?.bottom || 20,
          paddingLeft: viewportSafeArea?.left || 20,
          paddingRight: viewportSafeArea?.right || 20,
          paddingTop: viewportSafeArea?.top || 20
        }}
      >
        {(phase === 'slots' || phase === 'show_prizes_anim') && (
          <div className="hud-anim" style={{ position: 'absolute', top: viewportSafeArea?.top || 20, left: '0', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', gap: '8px' }}>
            {!isGameLocked && (
              <div style={{ background: 'rgba(0,0,0,0.6)', padding: '10px 20px', borderRadius: '30px', color: 'white', fontWeight: 'bold', border: '1px solid #ff1493', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', gap: '15px', pointerEvents: 'auto' }}>
                <span>Спины: {spinsLeft}</span>
              </div>
            )}

            {wonFaces.length > 0 && !isGameLocked && (
              <div style={{ background: 'rgba(255, 20, 147, 0.2)', padding: '5px 15px', borderRadius: '15px', color: '#ffb6c1', fontSize: '0.9rem', backdropFilter: 'blur(5px)' }}>
                🎁 {wonFaces.length}/8 получено
              </div>
            )}
          </div>
        )}

        {/* --- DYNAMIC LOADING SCREEN --- */}
        <div className={`fade-transition loading-panel ${phase === 'loading' ? 'visible' : 'hidden'}`}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2>Загружаем магию...</h2>
            {/* Optional: Show them the actual download progress! */}
            <p style={{ color: '#ffb6c1', marginTop: '5px' }}>{Math.round(progress)}%</p>
          </div>
        </div>

        {/* --- CENTERED CONTENT LAYER --- */}
        <div className="center-content-wrapper">
          <div className={`fade-transition question-panel ${phase === 'question' ? 'visible' : 'hidden'}`}>
            <h1>Ты меня любишь?</h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', alignItems: 'center', position: 'relative', zIndex: 100 }}>
              <button
                className="primary-btn"
                onClick={handleStartAssembly}
                style={{
                  transform: `scale(${1 + noCount * 0.2})`,
                  transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', 
                  transformOrigin: 'top center' 
                }}
              >
                Дааа
              </button>

              <button
                className="secondary-btn"
                onClick={() => {
                  setNoCount(prev => prev + 1)
                  try { hapticFeedback.impactOccurred('light') } catch (e) { }
                }}
              >
                {getNoButtonText()}
              </button>
            </div>
          </div>

          <div className={`fade-transition final-panel ${phase === 'show_prizes_done' ? 'visible' : 'hidden'}`}>
            <h2>Твои подарки</h2>
            <ul className="final-list">
              {wonFaces.map((faceIndex) => (
                <li key={faceIndex}>{PRIZES[faceIndex]}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* --- BOTTOM CONTENT LAYER --- */}
        <div className="bottom-content-wrapper">
          <div className={`fade-transition ${phase === 'ready_for_slots' ? 'visible' : 'hidden'}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', width: '100%' }}>
            <h3 style={{ margin: 0, color: 'white', textShadow: '0 0 10px #ff1493', fontSize: '1.2rem', textAlign: 'center' }}>
              И я тебя люблю ❤️ <br /> Вот твоя награда.
            </h3>
            <button className="gift-btn" onClick={() => { setPhase('slots'); try { hapticFeedback.impactOccurred('rigid') } catch (e) { } }}>
              Открыть 🎁
            </button>
          </div>
        </div>

        {/* --- SMART TOAST NOTIFICATION --- */}
        <div className={`toast-panel toast-transition ${showToast && phase !== 'show_prizes_done' && phase !== 'show_prizes_anim' ? 'toast-visible' : 'toast-hidden'}`}>
          <h2>{toastData.title}</h2>
          <p>{toastData.message}</p>
          <button
            className="toast-btn"
            onClick={() => {
              if (toastData.isFinal) {
                setPhase('show_prizes_anim')
              } else if (spinsLeft === 0) {
                // If they have 0 spins left, refill them regardless of whether they just won or lost!
                addSpins()
              }
              setShowToast(false)
            }}
          >
            {/* The button text dynamically changes based on their state */}
            {toastData.isFinal 
              ? "Показать призы ✨" 
              : spinsLeft === 0 
                ? (toastData.title === "Нет спинов!" ? "Сделать додеп 🪄" : "Забрать и депнуть 🪄") 
                : "Забрать!"}
          </button>
        </div>

      </div>
    </div>
  )
}

export default App