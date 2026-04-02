import { apiClient } from './client';
import { VariableBlock } from './unitEconomics';

export interface ChannelPreset {
  id: string;
  channel_name: string;
  variable_blocks: VariableBlock[];
  created_at: string;
  updated_at: string;
}

export const channelPresetsApi = {
  getAll: async () => {
    const response = await apiClient.get<ChannelPreset[]>('/channel-presets');
    return response.data;
  },
  getByChannel: async (channelName: string) => {
    const response = await apiClient.get<ChannelPreset>(`/channel-presets/${encodeURIComponent(channelName)}`);
    return response.data;
  },
  upsert: async (channelName: string, variableBlocks: VariableBlock[]) => {
    const response = await apiClient.put<ChannelPreset>(
      `/channel-presets/${encodeURIComponent(channelName)}`,
      { variable_blocks: variableBlocks }
    );
    return response.data;
  },
};
