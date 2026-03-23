import { useRef } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { type ThreeElements } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import { CustomEase } from 'gsap/all'
import { hapticFeedback } from '@tma.js/sdk-react'

gsap.registerPlugin(CustomEase)
const customEase = CustomEase.create("custom", "M0,0 C0.093,0.183 0.44,0.869 0.874,1 0.922,1.013 0.949,1 1,1 ")

type SlotMachineProps = ThreeElements['group'] & {
  canSpin: boolean;
  wonFaces: number[];
  onSpinStart: () => void;
  onSpinComplete: (results: [number, number, number]) => void;
}

export function SlotMachine({ canSpin, wonFaces, onSpinStart, onSpinComplete, ...props }: SlotMachineProps) {
  const { nodes, scene, animations } = useGLTF('/lovedolores/slotmachine.glb')
  
  const machineRef = useRef<THREE.Group>(null!)
  const { actions, names } = useAnimations(animations, machineRef)
  const isSpinning = useRef(false)

  const handleTestSpin = () => {
    if (isSpinning.current) return
    if (!canSpin) {
      try { hapticFeedback.notificationOccurred('error') } catch(e) {}
      return
    }

    isSpinning.current = true
    onSpinStart() 

    const handleAnim = actions[names[0]] 
    if (handleAnim) {
      handleAnim.reset()
      handleAnim.setLoop(THREE.LoopOnce, 1) 
      handleAnim.clampWhenFinished = true 
      handleAnim.play()
    }

    try { hapticFeedback.impactOccurred('soft') } catch(e) {}

    const reel1 = nodes.Reel1 as THREE.Mesh
    const reel2 = nodes.Reel2 as THREE.Mesh
    const reel3 = nodes.Reel3 as THREE.Mesh

    if (!reel1 || !reel2 || !reel3) return

    if (reel1.userData.currentFace === undefined) reel1.userData.currentFace = 0
    if (reel2.userData.currentFace === undefined) reel2.userData.currentFace = 0
    if (reel3.userData.currentFace === undefined) reel3.userData.currentFace = 0

    // --- GAME DIRECTOR MATH ---
    // Remove already won faces from the pool
    const availableFaces = [0, 1, 2, 3, 4, 5, 6, 7].filter(f => !wonFaces.includes(f));
    
    // We only roll a lucky spin if there are actually faces left to win!
    const isLuckySpin = availableFaces.length > 0 && Math.random() < 0.25; 
    let target1, target2, target3;

    if (isLuckySpin) {
      const winningFace = availableFaces[Math.floor(Math.random() * availableFaces.length)];
      target1 = target2 = target3 = winningFace;
    } else {
      target1 = Math.floor(Math.random() * 8);
      target2 = Math.floor(Math.random() * 8);
      target3 = Math.floor(Math.random() * 8);
      
      // Physically guarantee they NEVER match 3 identical faces on a losing spin
      if (target1 === target2 && target2 === target3) {
        target3 = (target3 + 1) % 8;
      }
    }

    const baseSpins1 = 8 * 6  
    const baseSpins2 = 8 * 10 
    const baseSpins3 = 8 * 14 

    const getFacesToTurn = (currentTotal: number, base: number, target: number) => {
      const currentFaceFacingUser = currentTotal % 8;
      let facesNeededToReachTarget = target - currentFaceFacingUser;
      if (facesNeededToReachTarget < 0) facesNeededToReachTarget += 8;
      return base + facesNeededToReachTarget;
    }

    reel1.userData.currentFace += getFacesToTurn(reel1.userData.currentFace, baseSpins1, target1)
    reel2.userData.currentFace += getFacesToTurn(reel2.userData.currentFace, baseSpins2, target2)
    reel3.userData.currentFace += getFacesToTurn(reel3.userData.currentFace, baseSpins3, target3)

    const sliceAngle = Math.PI / 4 

    gsap.to(reel1.rotation, {
      x: reel1.userData.currentFace * sliceAngle, duration: 2.0, ease: customEase, 
      onComplete: () => { try { hapticFeedback.impactOccurred('rigid') } catch(e){} }
    })
    gsap.to(reel2.rotation, {
      x: reel2.userData.currentFace * sliceAngle, duration: 3.0, ease: customEase, 
      onComplete: () => { try { hapticFeedback.impactOccurred('rigid') } catch(e){} }
    })
    gsap.to(reel3.rotation, {
      x: reel3.userData.currentFace * sliceAngle, duration: 4.0, ease: customEase, 
      onComplete: () => {
        try { hapticFeedback.impactOccurred('heavy') } catch(e){}
        const res1 = reel1.userData.currentFace % 8
        const res2 = reel2.userData.currentFace % 8
        const res3 = reel3.userData.currentFace % 8
        
        isSpinning.current = false
        onSpinComplete([res1, res2, res3])
      }
    })
  }

  return (
    <group ref={machineRef} {...props} onClick={handleTestSpin}>
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload('/lovedolores/slotmachine.glb')