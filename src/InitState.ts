import * as Phaser from "phaser";
import {Tenjin} from 'ionic-capacitor-tenjin';
//import { AdInfo, AdViewPosition, Applovin} from '@awesome-cordova-plugins/applovin';
//import {Capacitor} from "@capacitor/core";

// Card images
import { images, spritesheets } from "./constants/assets";
import { baseURL } from "./constants/loading";
import { GameStorage } from "./GameStorage";
import { AdLoadInfo, AdMob, AdmobConsentStatus, AdMobInitializationOptions, AdOptions, BannerAdOptions, BannerAdPluginEvents, BannerAdPosition, BannerAdSize, InterstitialAdPluginEvents, MaxAdContentRating } from "@capacitor-community/admob";
import { FacebookLogin } from "@capacitor-community/facebook-login";
import { FirebaseRemoteConfig } from "@capacitor-firebase/remote-config";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "./constants/screen";


const sceneConfig: Phaser.Types.Scenes.SettingsConfig = {
  active: false,
  key: "InitState",
  visible: false,
};

var bg_img: Phaser.GameObjects.Image;
var back_image: Phaser.GameObjects.Image;



const admobOptions: AdMobInitializationOptions = { // Set to true if you want to request tracking authorization on iOS (>14)
  tagForChildDirectedTreatment: false, // Set to true if your app is directed to children under the age of 13
  tagForUnderAgeOfConsent: false, // Set to true if your app is directed to users under the age of consent in Europe
  maxAdContentRating: MaxAdContentRating.General, // Set the maximum ad content rating
};
const options: AdOptions = {
  adId: 'ca-app-pub-4626203012465151/6152966494',
  // isTesting: true
  // npa: true
};
export async function initializeAdMob(): Promise<void> {
  await AdMob.initialize(admobOptions);
 
}




export async function banner(): Promise<void> {
  AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
    // Subscribe Banner Event Listener
  });



  const options: BannerAdOptions = {
    adId: 'ca-app-pub-4626203012465151/1042495647',
    adSize: BannerAdSize.BANNER,
    position: BannerAdPosition.BOTTOM_CENTER,
    margin: 0,
    // isTesting: true
    // npa: true
  };
  AdMob.showBanner(options);
}




export async function interstitial(): Promise<void> {
  FacebookLogin.initialize({ appId: "1516389039183430"})
  .then(() => {
    console.log('Facebook Login initialized successfully');
    // Additional logic after successful initialization
  })
  .catch(error => {
    console.error('Error initializing Facebook Login:', error);
    // Handle the error, e.g., show an error message to the user
  });
  await AdMob.prepareInterstitial(options);
  AdMob.addListener(InterstitialAdPluginEvents.Loaded, (info: AdLoadInfo) => {
    // Subscribe prepared interstitial
   
    console.log(`Interstitial info: ${info}`);
  });

  AdMob.addListener(InterstitialAdPluginEvents.Dismissed, async() => {
    console.log('Interstitial ad dismissed');
    await   AdMob.prepareInterstitial(options);
    // Add any additional logic you want to execute when the interstitial ad is dismissed
  });
}

export default class InitState extends Phaser.Scene{
  public constructor() {
    super(sceneConfig);
  }

  // eslint-disable-next-line max-lines-per-function
  public preload(): void {
    GameStorage.loadHighscore();
    GameStorage.loadShortestGameTime();
    GameStorage.loadTotalGameplayTime();
    GameStorage.loadLeftHanded();
    GameStorage.loadTapCard();
    // Set base url
    this.load.baseURL = baseURL;
    console.log("Heyyy");
    initializeAdMob();
    FirebaseRemoteConfig.fetchAndActivate()
    .then(() => {
      console.log('Remote config fetch and activate successful');

      // Use the remote config values in your app
      const remoteConfigValue = FirebaseRemoteConfig.getNumber({ key: 'inter_ad_freq' });
      console.log('Remote config value:', remoteConfigValue);
    })
    .catch((error) => {
      console.error('Error fetching and activating remote config:', error);

    });
   
    // Applovin.initialize("lzgTo1mcqBAN20DqbKbUAsU2i5TcHTa0QGZDHJr6V_TX0hLb1y4BpZDVfn6xFhyfyVuEqiKJipsiUBJW8Nhxyw")
    // .then(() => {
    //     console.log("Applovin initialize executed successfully");
    // })
    // .catch((error) => {
    //     console.error("Error executing Applovin initialize:", error);
    // });
    // initializeInterstitialAds();
    // initializeBannerAds();
    // Applovin.showBanner(BANNER_AD_UNIT_ID);
    Tenjin.initialize({ sdkKey: "Y6YCWEGCIDHZ1TE27XVZLCBA9VUH3LZB" })
    .then(() => {
        console.log("Tenjin initialization succeed");
        Tenjin.connect();
    })
    .catch((error) => {
        console.error("Tenjin initialization failed", error);
    });

    // Applovin.onInterstitialLoaded().subscribe((adInfo: AdInfo) => {
    //   this.onAdRevenuePaid(adInfo);
    // });

    // Background

    bg_img = this.add.image((screen.width * devicePixelRatio+100) / 2, (screen.height * devicePixelRatio) / 2, "init_bg");
    const scaleX = (SCREEN_WIDTH+100)/ bg_img.width;
    const scaleY = (SCREEN_HEIGHT+200) / bg_img.height;    
    bg_img.setScale(scaleX ,scaleY);
    back_image = this.add.image( SCREEN_WIDTH  / 2+50,SCREEN_HEIGHT/ 2.1, "img_load");
    back_image.setScale(SCREEN_WIDTH/1200);
    console.log("what's the scale: " + scaleX +"-"+ scaleY);

// Set the image's scale to fill the screen


    const progressBox = this.add.graphics();
    progressBox.fillStyle(0xaaaaaa, 0.8);
    progressBox.fillRect( (screen.width* devicePixelRatio)  / 2-200,(screen.height* devicePixelRatio)/ 1.4, 500, 60).setDepth(98);

    const progressBar = this.add.graphics();

    // const assetText = this.make.text({
    //   style: {
    //     color: "#000000",
    //     font: "12px monospace",
    //   },
    //   text: "",
    //   x: (screen.width* devicePixelRatio)  / 2,
    //   y: (screen.height* devicePixelRatio)/ 2 + 100,
    // });

    // assetText.setOrigin(0.5, 0.5);

    this.load.on("progress", (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x000000, 1);
      progressBar.fillRect((screen.width* devicePixelRatio)  / 2-200, (screen.height* devicePixelRatio)/ 1.4, 106 * value, 60).setDepth(99);
    });

    // this.load.on("fileprogress", (file: { key: string }) =>
    //   assetText.setText(`Loading asset: ${file.key}`)
    // );

    this.load.on("complete", () => {
      progressBar.destroy();
      progressBox.destroy();
      // assetText.destroy();
    });

    // Images
    images.forEach(({ key, file }) => this.load.image(key, file));

    // Spritesheets
    spritesheets.forEach(({ file, frameHeight, frameWidth, key }) => {
      this.load.spritesheet(key, file, { frameHeight, frameWidth });
    });
  }

//   public onAdRevenuePaid(maxAd: AdInfo): void {
//     console.log("What");
    
//     Tenjin.eventAdImpressionAppLovin({
//         json: {
//             format: "Banner",
//             revenue_precision: "exact",
//             ad_unit_id: maxAd.adUnitId,
//             network_placement: "banner_regular",
//             placement: maxAd.placement,
//             publisher_revenue_decimal: "0",
//             ad_revenue_currency: "USD",
//             revenue: maxAd.revenue,
//             creative_id: maxAd.creativeId,
//             publisher_revenue_micro: "0",
//             network_name: maxAd.networkName
//         }
//     })
//     .then(() => {
//         console.log("eventAdImpressionAppLovin executed successfully");
//     })
//     .catch((error) => {
//         console.error("Error executing eventAdImpressionAppLovin:", error);
//     });
// }

  public async create(): Promise<void> {
    try {
      const [trackingInfo, consentInfo] = await Promise.all([
        AdMob.trackingAuthorizationStatus(),
        AdMob.requestConsentInfo(),
      ]);
  
      if (trackingInfo.status === 'notDetermined') {
        await AdMob.requestTrackingAuthorization();
      }
  
      const authorizationStatus = await AdMob.trackingAuthorizationStatus();
  
      if (
        authorizationStatus.status === 'authorized' &&
        consentInfo.isConsentFormAvailable &&
        consentInfo.status === AdmobConsentStatus.REQUIRED
      ) {
        // Show the consent form and wait for it to be closed
        await AdMob.showConsentForm();
  
        // Consent form has been closed, continue to the next scene
        this.scene.start('GameState');
        banner();
        interstitial();
      } else {
        // No need for consent form, proceed to the next scene
        this.scene.start('GameState');
        banner();
        interstitial();

      }
    } catch (error) {
      console.error('Error handling AdMob consent:', error);
      // Handle errors appropriately
    }
    }
}
