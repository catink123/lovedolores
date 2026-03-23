import { useGLTF, Sparkles, Billboard } from '@react-three/drei' 
import { useFrame, type ThreeElements } from '@react-three/fiber'
import { useRef, useEffect, useState, useMemo } from 'react' 
import * as THREE from 'three'
import gsap from 'gsap'

type HeartProps = ThreeElements['group'] & { isAssembling?: boolean }

export function Heart({ isAssembling = false, ...props }: HeartProps) {
  const { nodes } = useGLTF('/lovedolores/heart.glb')
  
  // 1. NEW: The isolated wrapper purely for Gyro Parallax
  const gyroGroupRef = useRef<THREE.Group>(null!)
  const targetGyro = useRef({ x: 0, y: 0 })

  const spinGroupRef = useRef<THREE.Group>(null!)
  const heartGroupRef = useRef<THREE.Group>(null!) 
  const masterSpinActive = useRef(true) 
  
  const [sparkleConfig, setSparkleConfig] = useState({ opacity: 0, speed: 1.4 })

  const glowMeshRef = useRef<THREE.Mesh>(null!)
  const glowMaterialRef = useRef<THREE.MeshBasicMaterial>(null!)

  const heartMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#ff1493"),
      emissive: new THREE.Color("#ff007f"),
      emissiveIntensity: 0, 
      toneMapped: true,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      roughness: 0.25,
      metalness: 0.95
    })
    mat.userData = { glow: 0, pulseActive: 0 }
    return mat
  }, [])

  const glowTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const context = canvas.getContext('2d')!
    
    const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128)
    gradient.addColorStop(0, 'rgba(255, 20, 147, 1)')   
    gradient.addColorStop(0.5, 'rgba(255, 20, 147, 0.3)') 
    gradient.addColorStop(0.85, 'rgba(255, 20, 147, 0.05)') 
    gradient.addColorStop(1, 'rgba(255, 20, 147, 0)')   
    
    context.fillStyle = gradient
    context.fillRect(0, 0, 256, 256)
    return new THREE.CanvasTexture(canvas)
  }, [])

  // 2. THE DEVICE ORIENTATION LISTENER
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      // If the device has no gyro (like a desktop), exit gracefully
      if (e.beta === null || e.gamma === null) return;

      // beta: front-to-back tilt. Neutral holding position is roughly 45 degrees.
      const beta = THREE.MathUtils.clamp(e.beta - 45, -30, 30)
      // gamma: left-to-right tilt.
      const gamma = THREE.MathUtils.clamp(e.gamma, -30, 30)

      // Convert the clamped degrees into a subtle radian rotation target
      targetGyro.current.x = THREE.MathUtils.degToRad(beta) * 0.6
      targetGyro.current.y = THREE.MathUtils.degToRad(gamma) * 0.6
    }

    window.addEventListener('deviceorientation', handleOrientation)
    return () => window.removeEventListener('deviceorientation', handleOrientation)
  }, [])

  useFrame((state, delta) => {
    if (!spinGroupRef.current || !heartGroupRef.current || !gyroGroupRef.current) return

    // --- THE IOS SPRING PARALLAX ---
    // Smoothly spring the outer group towards the target gyro coordinates on every frame
    gyroGroupRef.current.rotation.x = THREE.MathUtils.damp(gyroGroupRef.current.rotation.x, targetGyro.current.x, 4, delta)
    gyroGroupRef.current.rotation.y = THREE.MathUtils.damp(gyroGroupRef.current.rotation.y, targetGyro.current.y, 4, delta)

    if (masterSpinActive.current) {
      spinGroupRef.current.rotation.y += delta * 0.1 
    }

    const fastAngle = heartGroupRef.current.rotation.z
    const cosA = Math.cos(-fastAngle)
    const sinA = Math.sin(-fastAngle)

    const time = state.clock.elapsedTime * 0.35 
    const fragments = heartGroupRef.current.children

    fragments.forEach((mesh) => {
      if (mesh.userData.isTweening) return 

      const angle = mesh.userData.angleOffset + time
      let infX = Math.cos(angle) * 1 + mesh.userData.scatterX
      let infY = Math.sin(angle * 2) * 1 + mesh.userData.scatterY
      let infZ = Math.sin(angle) * 1 + mesh.userData.scatterZ

      const finalX = infX * cosA - infY * sinA
      const finalY = infX * sinA + infY * cosA

      mesh.position.set(finalX, finalY, infZ)

      mesh.rotation.x += mesh.userData.rotX * delta
      mesh.rotation.y += mesh.userData.rotY * delta
      mesh.rotation.z += mesh.userData.rotZ * delta
    })

    if (!isAssembling) {
      heartMaterial.emissiveIntensity = heartMaterial.userData.glow
    } else {
      const sineValue = Math.sin(state.clock.elapsedTime * 3)
      const pulseScale = 3 + sineValue * 0.09 
      heartGroupRef.current.scale.set(pulseScale, pulseScale, pulseScale)

      heartMaterial.emissiveIntensity = heartMaterial.userData.glow + (sineValue * 0.02 * heartMaterial.userData.pulseActive)
    }
  })

  useEffect(() => {
    if (!spinGroupRef.current || !heartGroupRef.current || !glowMeshRef.current || !glowMaterialRef.current) return
    
    const fragments = heartGroupRef.current.children

    if (!isAssembling) {
      masterSpinActive.current = true
      
      setSparkleConfig({ opacity: 0, speed: 1.4 })
      gsap.set(glowMaterialRef.current, { opacity: 0 })
      gsap.set(glowMeshRef.current.scale, { x: 0.1, y: 0.1, z: 0.1 })
      gsap.set(heartMaterial.userData, { glow: 0, pulseActive: 0 })
      
      gsap.set(heartGroupRef.current.rotation, { z: 0 })
      gsap.set(heartGroupRef.current.scale, { x: 3, y: 3, z: 3 })
      
      fragments.forEach(mesh => { mesh.userData.isTweening = false })
    }

    fragments.forEach((mesh) => {
      if (mesh.userData.angleOffset === undefined) {
        mesh.userData.targetPos = mesh.position.clone()
        mesh.userData.targetRot = mesh.rotation.clone()

        mesh.userData.angleOffset = Math.random() * Math.PI * 2
        
        const scatterDistance = Math.random() * 0.4
        const scatterAngle = Math.random() * Math.PI * 2
        mesh.userData.scatterX = Math.cos(scatterAngle) * scatterDistance
        mesh.userData.scatterY = Math.sin(scatterAngle) * scatterDistance
        mesh.userData.scatterZ = Math.sin(scatterAngle * 2) * scatterDistance

        mesh.userData.rotX = (Math.random() - 0.5) * 2.5
        mesh.userData.rotY = (Math.random() - 0.5) * 2.5
        mesh.userData.rotZ = (Math.random() - 0.5) * 2.5
        
        mesh.userData.isTweening = false 
      }
    })

    if (isAssembling) {
      masterSpinActive.current = false 
      
      fragments.forEach((mesh, index) => {
        gsap.to(mesh.position, { 
          x: mesh.userData.targetPos.x, y: mesh.userData.targetPos.y, z: mesh.userData.targetPos.z, 
          duration: 2.0, ease: "back.out(1.2)", delay: index * 0.05,
          onStart: () => { mesh.userData.isTweening = true } 
        })
        gsap.to(mesh.rotation, { 
          x: mesh.userData.targetRot.x, y: mesh.userData.targetRot.y, z: mesh.userData.targetRot.z, 
          duration: 2.0, ease: "back.out(1.2)", delay: index * 0.05 
        })
      })

      const currentMasterY = spinGroupRef.current.rotation.y
      const finalMasterY = currentMasterY + 0.225 

      gsap.to(spinGroupRef.current.rotation, {
        y: finalMasterY,
        duration: 4.5,
        ease: "power2.out"
      })

      const targetHeartZ = finalMasterY + (Math.PI * 8);

      gsap.to(heartGroupRef.current.rotation, { 
        z: targetHeartZ, 
        duration: 4.5, 
        ease: "power2.out" 
      })

      const proxy = { opacity: 0, speed: 10 }
      gsap.to(proxy, { opacity: 1, speed: 0.2, duration: 4.5, ease: "power2.out", onUpdate: () => setSparkleConfig({ opacity: proxy.opacity, speed: proxy.speed }) })

      gsap.to(heartMaterial.userData, { glow: 2, duration: 4.3, ease: "power2.in" })

      gsap.to(glowMeshRef.current.scale, { x: 10, y: 10, z: 10, duration: 0.4, delay: 4.3, ease: "power2.out" })
      gsap.to(glowMaterialRef.current, { opacity: 1, duration: 0.4, delay: 4.3, ease: "power2.out" })
      gsap.to(heartMaterial.userData, { glow: 6, duration: 0.4, delay: 4.3, ease: "power2.out" })

      gsap.to(glowMeshRef.current.scale, { x: 6, y: 6, z: 6, duration: 2.0, delay: 4.7, ease: "power2.inOut" })
      gsap.to(glowMaterialRef.current, { opacity: 0.1, duration: 2.0, delay: 4.7, ease: "power2.inOut" })
      gsap.to(heartMaterial.userData, { glow: 0.05, pulseActive: 1, duration: 2.0, delay: 4.7, ease: "power2.inOut" })
    }
  }, [isAssembling, heartMaterial]) 

  return (
    <group {...props}>
      <Billboard>
        <mesh ref={glowMeshRef}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial ref={glowMaterialRef} map={glowTexture} transparent={true} opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </Billboard>
      
      <Sparkles count={100} scale={5} size={3} speed={sparkleConfig.speed} opacity={sparkleConfig.opacity} color="#ffb6c1" noise={10} />

      {/* 3. NEW: The isolated wrapper for the Gyro physics! */}
      <group ref={gyroGroupRef}>
        <group ref={spinGroupRef}>
          <group ref={heartGroupRef} rotation-x={Math.PI / 2} scale={3}>
            {Object.values(nodes).map((node) => {
              const meshNode = node as THREE.Mesh
              if (meshNode.isMesh) {
                return (
                  <mesh key={meshNode.uuid} geometry={meshNode.geometry} position={meshNode.position} rotation={meshNode.rotation} scale={meshNode.scale} material={heartMaterial} />
                )
              }
              return null
            })}
          </group>
        </group>
      </group>

    </group>
  )
}