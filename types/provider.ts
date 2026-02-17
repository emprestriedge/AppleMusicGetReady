
import { SpotifyUser, SpotifyDevice, SpotifyTrack } from '../types';

/**
 * IMusicProvider - A generic interface for music service interactions.
 * This allows the UI to remain agnostic of the underlying service (Spotify, Apple Music, etc).
 */
export interface IMusicProvider {
  /**
   * Triggers the service-specific authorization/login flow.
   */
  authorize(): Promise<void>;

  /**
   * Clears the current session and unauthorizes the user.
   */
  unauthorize(): void;

  /**
   * Fetches the current authenticated user's profile information.
   */
  getAccountDetails(): Promise<SpotifyUser | null>;

  /**
   * Plays a list of track/episode identifiers.
   * @param uris List of identifiers (URIs)
   * @param index Optional starting index
   */
  play(uris: string[], index?: number): Promise<void>;

  /**
   * Controls the active playback state.
   */
  setPlaybackState(state: "play" | "pause" | "next" | "previous"): Promise<void>;

  /**
   * Retrieves the current playback state (item, progress, device).
   */
  getPlaybackStatus(): Promise<any>;

  /**
   * Fetches tracks from a specific source (playlist ID, 'liked_songs', etc).
   */
  getTracks(sourceId: string, limit?: number): Promise<SpotifyTrack[]>;

  /**
   * Creates a new playlist/container in the user's library.
   */
  createContainer(name: string, description?: string): Promise<any>;

  /**
   * Toggles whether a track is 'favorited' (Liked/Saved) in the user's library.
   * Note: In this version, we map this to Spotify's 'Gems' or 'Liked' logic.
   */
  toggleFavorite(id: string, state: boolean): Promise<void>;

  /**
   * Lists available output devices for the provider.
   */
  getOutputDevices(): Promise<SpotifyDevice[]>;

  /**
   * Transfers active playback to a specific device.
   */
  transfer(deviceId: string): Promise<void>;
}
