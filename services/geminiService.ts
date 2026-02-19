
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { RuleSettings, RunOption, SmartMixPlan, VibeType } from "../types";
import { MOOD_ZONES, DISCOVERY_ZONES } from "../constants";

/**
 * getMixInsight - Uses Gemini to generate AI-powered insights for the music mix.
 */
export const getMixInsight = async (option: RunOption, rules: RuleSettings): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const moodLabel = (rules.moodLevel ?? 0.5) < MOOD_ZONES.ZEN_MAX
      ? 'Mellow/Zen'
      : (rules.moodLevel ?? 0.5) < MOOD_ZONES.FOCUS_MAX
      ? 'Balanced/Focus'
      : 'High Energy/Chaos';

    const discoveryLabel = (rules.discoverLevel ?? 0) <= DISCOVERY_ZONES.ZERO_CUTOFF
      ? 'Pure Favorites'
      : (rules.discoverLevel ?? 0) <= DISCOVERY_ZONES.FAMILIAR_MAX
      ? 'Familiar Territory'
      : 'Outside Your Norm';

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `Provide a short, 1-sentence professional musicology insight for a user's playlist mix.
        Mix Name: ${option.name}
        Context: ${option.description}
        Settings: Length=${rules.playlistLength} tracks, Mood=${moodLabel}, Exploration=${discoveryLabel}.
        Insight:`,
    });

    return response.text || "Sync Engine operational. Composing multi-source catalog...";
  } catch (error) {
    console.error("Gemini Mix Insight failed:", error);
    return "Sync Engine operational. Composing multi-source catalog...";
  }
};

/**
 * getSmartMixPlan - Generates a preview summary of what the mix will look like
 * based on the mood and discovery slider positions.
 *
 * This now mirrors the actual engine logic so the preview is accurate.
 */
export const getSmartMixPlan = async (
  vibe: VibeType,
  discoverLevel: number,
  moodLevel: number,
  playlistLength: number = 35
): Promise<SmartMixPlan> => {

  // Mirror the mood zone logic from playbackEngine so the preview matches reality
  const mood = Math.max(0, Math.min(1, moodLevel));
  const discoveryCount = discoverLevel <= DISCOVERY_ZONES.ZERO_CUTOFF
    ? 0
    : Math.round(playlistLength * discoverLevel * 0.4);
  const sourceTotal = playlistLength - discoveryCount;

  // Same weight functions as calculateMoodRecipe in playbackEngine
  const likedWeight    = Math.max(0, 1 - mood * 1.2);
  const acousticWeight = Math.max(0, 1 - mood * 1.5);
  const shazamWeight   = 0.3 + Math.sin(mood * Math.PI) * 0.4;
  const a7xCoreWeight  = 0.35;
  const a7xSimWeight   = mood * 0.9;
  const rapWeight      = Math.max(0, (mood - 0.4) * 2.0);

  const totalWeight = likedWeight + acousticWeight + shazamWeight + a7xCoreWeight + a7xSimWeight + rapWeight;
  const allocate = (w: number) => totalWeight > 0 ? Math.round((w / totalWeight) * sourceTotal) : 0;

  const liked    = allocate(likedWeight);
  const acoustic = allocate(acousticWeight);
  const shazam   = allocate(shazamWeight);
  const a7x      = allocate(a7xCoreWeight) + allocate(a7xSimWeight);
  const rap      = allocate(rapWeight);

  const moodLabel = mood < MOOD_ZONES.ZEN_MAX ? 'Zen' : mood < MOOD_ZONES.FOCUS_MAX ? 'Focus' : 'Chaos';
  const discoveryLabel = discoverLevel <= DISCOVERY_ZONES.ZERO_CUTOFF
    ? 'No new tracks'
    : discoverLevel <= DISCOVERY_ZONES.FAMILIAR_MAX
    ? 'Familiar territory'
    : 'Outside your norm';

  return {
    preset: `${vibe} · ${moodLabel} Mood · ${discoveryLabel}`,
    summary: `Liked ${liked} • 90sAltRock ${acoustic} • Shazam ${shazam} • A7X ${a7x} • Rap ${rap} • New ${discoveryCount}`,
  };
};
