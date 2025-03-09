import { Storage } from '@capacitor/storage';
import GameState from './GameState';
import { FirebaseRemoteConfig } from '@capacitor-firebase/remote-config';

export class GameStorage {
  private static HIGHSCORE_KEY = 'highscore';
  private static LEFTHANDED_KEY = 'left_handed';
  private static TAP_CARD_KEY = 'tap_card';
  private static TOTAL_GAMEPLAY_TIME_KEY = 'totalGameplayTime';
  private static SHORTEST_GAME_TIME_KEY = 'shortestGameTime';
  private static INTERTITIAL_FREQUENCY_KEY= 'intersitial_freq';
  private static DEFAULT_INTERSTITIAL_VALUE = 3;


  public static async saveInterstitialValue(interstitialValue: number):Promise<void>{
    await Storage.set({ key: GameStorage.INTERTITIAL_FREQUENCY_KEY, value: interstitialValue.toString() });
  }

  public static async loadInterstitialValue(): Promise<void> {
    const { value } = await Storage.get({ key: GameStorage.INTERTITIAL_FREQUENCY_KEY });
    
    // Use await here to get the actual number value from Firebase Remote Config
    FirebaseRemoteConfig.getNumber({ key: 'inter_ad_freq' })
    .then((remoteConfigValueResult) => {
      // Extract the number value from the result
      const remoteConfigValue = remoteConfigValueResult.value;

      // Now, you can use remoteConfigValue as a number
      GameState.interstitial_freq = value ? parseInt(value, 10) : remoteConfigValue;
    })
    .catch((error) => {
      // Handle the error, and provide a default value (3 in this case)
      console.error('Error retrieving number from Firebase Remote Config:', error);

      // Use the default value
      GameState.interstitial_freq = value ? parseInt(value, 10) : GameStorage.DEFAULT_INTERSTITIAL_VALUE;
    });
    }
  

  public static async saveHighscore(highscore: number): Promise<void> {
    await Storage.set({ key: GameStorage.HIGHSCORE_KEY, value: highscore.toString() });
  }

  public static async loadHighscore(): Promise<void> {
    const { value } = await Storage.get({ key: GameStorage.HIGHSCORE_KEY });
    GameState.highscore = value ? parseInt(value, 10) : 0;
  }
  

  public static async saveTapCard(isActive: boolean): Promise<void> {
    await Storage.set({ key: GameStorage.TAP_CARD_KEY, value: isActive.toString() });
  }

  public static async loadTapCard(): Promise<void> {
    const { value } = await Storage.get({ key: GameStorage.TAP_CARD_KEY });
    console.log("The value of tap: "+ value);
    GameState.isHitMoveEnabled = value ? value === 'true' : true;
  }
  
  public static async saveLeftHanded(isActive: boolean): Promise<void> {
    await Storage.set({ key: GameStorage.LEFTHANDED_KEY, value: isActive.toString() });
  }

  public static async loadLeftHanded(): Promise<void> {
    const { value } = await Storage.get({ key: GameStorage.LEFTHANDED_KEY });
    console.log("The value of left: "+ value);

    GameState.isLeftHanded = value ? value === 'true' : false;
  }

  public static async saveTotalGameplayTime(totalGameplayTime: number): Promise<void> {
    console.log("Ehem-ehem");
    GameState.totalTime = totalGameplayTime;
  
    await Storage.set({ key: GameStorage.TOTAL_GAMEPLAY_TIME_KEY, value: totalGameplayTime.toString() });
    console.log("Mehe-Mehe");
  }

  public static async loadTotalGameplayTime(): Promise<void> {
    const { value } = await Storage.get({ key: GameStorage.TOTAL_GAMEPLAY_TIME_KEY });
    console.log("ZUhahahah: "+ value);
    GameState.totalTime = value ? parseInt(value, 10) : 0;
    GameState.totalTimeText.text = (GameStorage.formatTime(GameState.totalTime))
    console.log("ZUhahahah2: "+ GameState.totalTime);
  }

  public static async saveShortestGameTime(shortestGameTime: number): Promise<void> {

    console.log("Cidden yeto: "+ shortestGameTime);
    await Storage.set({ key: GameStorage.SHORTEST_GAME_TIME_KEY, value: shortestGameTime.toString() });
  }

  public static async loadShortestGameTime(): Promise<void> {
    const { value } = await Storage.get({ key: GameStorage.SHORTEST_GAME_TIME_KEY });
    GameState.shortestTime = value ? parseInt(value, 10) : 99999;
    console.log("GameState.shortestTime inside storage: "+ GameState.shortestTime);

    GameState.shortestTimeText.text = (GameStorage.formatTime(GameState.shortestTime))

  }

  public isShorterTime(newTime: string, existingTime: string): boolean {
    const newTimeParts = newTime.split(":").map(Number);
    const existingTimeParts = existingTime.split(":").map(Number);
  
    // Compare hours
    if (newTimeParts[0] < existingTimeParts[0]) {
      return true;
    } else if (newTimeParts[0] > existingTimeParts[0]) {
      return false;
    }
  
    // Compare minutes
    if (newTimeParts[1] < existingTimeParts[1]) {
      return true;
    } else if (newTimeParts[1] > existingTimeParts[1]) {
      return false;
    }
  
    // Compare seconds
    return newTimeParts[2] < existingTimeParts[2];
  }

  public static bigIntToString(timeBigInt: BigInt): string {
    const seconds = Number(timeBigInt) / 1000; // Convert from milliseconds to seconds
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
  
    const padZero = (num: number): string => (num < 10 ? `0${num}` : `${num}`);
  
    return `${padZero(hours)}:${padZero(minutes)}:${padZero(remainingSeconds)}`;
  }
  
  
  public static stringToNumber(timeString: string): number {
    const [hours, minutes, seconds] = timeString.split(':').map(Number);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    return totalSeconds * 1000; // Convert from seconds to milliseconds
  }
  
  public static formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }
  
}
