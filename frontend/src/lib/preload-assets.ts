// Background assets
import siteBackground from "@/assets/background/site_background.png";
import siteBackgroundBrown from "@/assets/background/site_background_brown.png";
import pattern from "@/assets/background/pattern.png";

// Container assets
import basicBar from "@/assets/containers/basic_bar.png";
import borderContainer from "@/assets/containers/border_container.png";
import cardSmall from "@/assets/containers/card_small.png";
import cardDetailed from "@/assets/containers/card_detailed.png";
import dialogWithHeader from "@/assets/containers/dialog_with_header.png";
import header from "@/assets/containers/header.png";
import headerNoTabs from "@/assets/containers/header_no_tabs.png";
import navBackground from "@/assets/containers/nav_background.png";
import numberBox from "@/assets/containers/number_box.png";
import redContainer from "@/assets/containers/red_container.png";
import scroll from "@/assets/containers/scroll.png";
import scrollLight from "@/assets/containers/scroll_light.png";
import titleBox from "@/assets/containers/title_box.png";

// Card background assets
import cardBackground1Short from "@/assets/card_background/1_short.png";
import cardBackground2 from "@/assets/card_background/2.png";
import cardBackground2Small from "@/assets/card_background/2_small.png";
import cardBackground2Wide from "@/assets/card_background/2_wide.png";
import cardBackground3Long from "@/assets/card_background/3_long.png";
import cardBackground4Long from "@/assets/card_background/4_long.png";
import vertical1Short from "@/assets/card_background/vertical_1_short.png";
import vertical2 from "@/assets/card_background/vertical_2.png";
import vertical2Long from "@/assets/card_background/vertical_2_long.png";
import vertical3Long from "@/assets/card_background/vertical_3_long.png";

// Component assets
import backIcon from "@/assets/components/back.png";
import backIconHover from "@/assets/components/back_hover.png";
import botArrow from "@/assets/components/bot_arrow.png";
import botArrowHover from "@/assets/components/bot_arrow_hover.png";
import buyIcon from "@/assets/components/buy.png";
import checked from "@/assets/components/checked.png";
import editIcon from "@/assets/components/edit.png";
import exitIcon from "@/assets/components/exit.png";
import exitIconHover from "@/assets/components/exit_hover.png";
import expandIcon from "@/assets/components/expand.png";
import gearIcon from "@/assets/components/gear.png";
import gearIconHover from "@/assets/components/gear_hover.png";
import helpIcon from "@/assets/components/help.png";
import helpIconHover from "@/assets/components/help_hover.png";
import leftArrow from "@/assets/components/left_arrow.png";
import leftArrowHover from "@/assets/components/left_arrow_hover.png";
import minusIcon from "@/assets/components/minus.png";
import minusIconHover from "@/assets/components/minus_hover.png";
import optionButton from "@/assets/components/option_button.png";
import plusIcon from "@/assets/components/plus.png";
import plusIconHover from "@/assets/components/plus_hover.png";
import primaryButton from "@/assets/components/primary_button.png";
import primaryButtonHover from "@/assets/components/primary_button_hover.png";
import rightArrow from "@/assets/components/right_arrow.png";
import rightArrowHover from "@/assets/components/right_arrow_hover.png";
import secondaryButton from "@/assets/components/secondary_button.png";
import secondaryButtonHover from "@/assets/components/secondary_button_hover.png";
import tabButtonSelected from "@/assets/components/tab_button_selected.png";
import tabButtonUnselected from "@/assets/components/tab_button_unselected.png";
import topArrow from "@/assets/components/top_arrow.png";
import topArrowHover from "@/assets/components/top_arrow_hover.png";
import unchecked from "@/assets/components/unchecked.png";

// Icon assets
import chestIcon from "@/assets/icons/chest.png";
import chestOpenIcon from "@/assets/icons/chest_open.png";
import exitIconSmall from "@/assets/icons/exit.png";
import fightIcon from "@/assets/icons/Fight.png";
import greedIcon from "@/assets/icons/greed.png";
import menuIcon from "@/assets/icons/Menu.png";
import minusIconSmall from "@/assets/icons/Minus.png";
import needIcon from "@/assets/icons/need.png";
import optionsIcon from "@/assets/icons/Options.png";
import plusIconSmall from "@/assets/icons/Plus.png";
import scullIcon from "@/assets/icons/Scull.png";
import scull2Icon from "@/assets/icons/Scull2.png";
import tradeIcon from "@/assets/icons/trade.png";

// Scroll assets
import scroll1 from "@/assets/scroll/1.png";
import scroll2 from "@/assets/scroll/2.png";
import scroll3 from "@/assets/scroll/3.png";
import scroll5 from "@/assets/scroll/5.png";

// List of all assets to preload
const CAMPAIGN_ASSETS = [
  // Backgrounds
  siteBackground,
  siteBackgroundBrown,
  pattern,

  // Containers
  basicBar,
  borderContainer,
  cardSmall,
  cardDetailed,
  dialogWithHeader,
  header,
  headerNoTabs,
  navBackground,
  numberBox,
  redContainer,
  scroll,
  scrollLight,
  titleBox,

  // Card backgrounds
  cardBackground1Short,
  cardBackground2,
  cardBackground2Small,
  cardBackground2Wide,
  cardBackground3Long,
  cardBackground4Long,
  vertical1Short,
  vertical2,
  vertical2Long,
  vertical3Long,

  // Components
  backIcon,
  backIconHover,
  botArrow,
  botArrowHover,
  buyIcon,
  checked,
  editIcon,
  exitIcon,
  exitIconHover,
  expandIcon,
  gearIcon,
  gearIconHover,
  helpIcon,
  helpIconHover,
  leftArrow,
  leftArrowHover,
  minusIcon,
  minusIconHover,
  optionButton,
  plusIcon,
  plusIconHover,
  primaryButton,
  primaryButtonHover,
  rightArrow,
  rightArrowHover,
  secondaryButton,
  secondaryButtonHover,
  tabButtonSelected,
  tabButtonUnselected,
  topArrow,
  topArrowHover,
  unchecked,

  // Icons
  chestIcon,
  chestOpenIcon,
  exitIconSmall,
  fightIcon,
  greedIcon,
  menuIcon,
  minusIconSmall,
  needIcon,
  optionsIcon,
  plusIconSmall,
  scullIcon,
  scull2Icon,
  tradeIcon,

  // Scrolls
  scroll1,
  scroll2,
  scroll3,
  scroll5,
];

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

export async function preloadCampaignAssets(): Promise<void> {
  const promises = CAMPAIGN_ASSETS.map((src) =>
    preloadImage(src).catch((error) => {
      console.warn("Asset preload failed:", error);
      // Don't fail the entire preload for a single image
      return Promise.resolve();
    })
  );

  await Promise.all(promises);
}

export function preloadCampaignAssetsWithProgress(
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  const total = CAMPAIGN_ASSETS.length;
  let loaded = 0;

  const promises = CAMPAIGN_ASSETS.map((src) =>
    preloadImage(src)
      .catch((error) => {
        console.warn("Asset preload failed:", error);
        return Promise.resolve();
      })
      .finally(() => {
        loaded++;
        onProgress?.(loaded, total);
      })
  );

  return Promise.all(promises).then(() => undefined);
}
