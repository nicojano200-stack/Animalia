// Seconds, world pixels, and pixels/second. Every editable value has slider metadata.
export const DEFAULT_CONFIG = Object.freeze({maxSpeed:310, acceleration:2500, groundFriction:1850, airAcceleration:2050, jumpVelocity:590, gravity:1480, maxFallSpeed:650, coyoteTime:0.10, jumpBufferTime:0.13, carrySpeedMultiplier:0.85, jumpCutMultiplier:0.48, rollSpeedMultiplier:1.42, rollTurnMultiplier:0.35, springVelocity:860, windAcceleration:900, manaRegen:15, roundSeconds:90, cameraFollow:7, cameraLookAhead:0.25, shakeStrength:6, wallSlideSpeed:95, wallJumpVelocity:635, wallJumpPush:385, wallJumpLock:0.16, wallCoyoteTime:0.09,iceFriction:110,honeySpeed:0.52,conveyorSpeed:105,crumbleDelay:0.65,crumbleRespawn:3.5,vineGrabRadius:38,vineJumpVelocity:640,airDrag:0,fallGravityMult:1,lowJumpGravityMult:1,wallCheckDistance:0.8});
export const CONFIG_RANGES = {maxSpeed:[100,650,5],acceleration:[300,6000,50],groundFriction:[100,5000,50],airAcceleration:[200,5000,50],jumpVelocity:[250,1000,10],gravity:[400,3000,20],maxFallSpeed:[200,1400,10],coyoteTime:[0,0.3,0.01],jumpBufferTime:[0,0.3,0.01],carrySpeedMultiplier:[0.4,1,0.01],jumpCutMultiplier:[0.1,1,0.01],rollSpeedMultiplier:[1,2.5,0.01],rollTurnMultiplier:[0.1,1,0.01],springVelocity:[300,1300,10],windAcceleration:[0,2200,25],manaRegen:[0,50,1],roundSeconds:[15,180,5],cameraFollow:[1,20,0.5],cameraLookAhead:[0,0.7,0.01],shakeStrength:[0,20,0.5],wallSlideSpeed:[40,300,5],wallJumpVelocity:[350,950,10],wallJumpPush:[200,650,5],wallJumpLock:[0.05,0.3,0.01],wallCoyoteTime:[0,0.2,0.01],iceFriction:[10,800,10],honeySpeed:[0.2,1,0.01],conveyorSpeed:[0,250,5],crumbleDelay:[0.2,2,0.05],crumbleRespawn:[1,8,0.25],vineGrabRadius:[15,70,1],vineJumpVelocity:[350,950,10],airDrag:[0,1000,5],fallGravityMult:[0.5,2.5,0.05],lowJumpGravityMult:[1,4,0.05],wallCheckDistance:[0.5,4,0.1]};
export const config = {...DEFAULT_CONFIG};
export const STEP = 1/60;

// The supplied movement.js values, mapped to the existing world/feet-based engine.
// Zero airDrag preserves the legacy airAcceleration * 0.18 behavior.
export const SNAPPY_MOVEMENT = Object.freeze({maxSpeed:260,acceleration:2200,groundFriction:1800,airAcceleration:1600,airDrag:150,jumpVelocity:560,gravity:1500,fallGravityMult:1.15,lowJumpGravityMult:2.2,maxFallSpeed:720,coyoteTime:0.1,jumpBufferTime:0.1,jumpCutMultiplier:1,wallSlideSpeed:90,wallJumpPush:300,wallJumpVelocity:520,wallJumpLock:0.12,wallCoyoteTime:0.1,wallCheckDistance:2});
export function applyMovementPreset(target,name){
  if(name!=='snappy'&&name!=='classic')return false;
  for(const key of Object.keys(SNAPPY_MOVEMENT))target[key]=name==='snappy'?SNAPPY_MOVEMENT[key]:DEFAULT_CONFIG[key];
  return true;
}
