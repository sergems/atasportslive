import React from 'react';
import { NativeTabs } from 'expo-router/native-tabs';
import { useChannelStatus } from '@/hooks/use-channel-status';

export default function TabsLayout() {
  const { ch1Live, ch2Live, ch3Live } = useChannelStatus();
  const anyLive = ch1Live || ch2Live || ch3Live;

  return (
    <NativeTabs minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {/* One slot for live channels: "Livestream" when nothing is on air,
          otherwise one tab per active channel (Live / Live 2 / Live 3). */}
      <NativeTabs.Trigger name="livestream" hidden={anyLive}>
        <NativeTabs.Trigger.Icon sf="video" md="live_tv" />
        <NativeTabs.Trigger.Label>Livestream</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="live" hidden={!ch1Live}>
        <NativeTabs.Trigger.Icon sf="video.fill" md="live_tv" />
        <NativeTabs.Trigger.Label>Live</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="live-2" hidden={!ch2Live}>
        <NativeTabs.Trigger.Icon sf="video.fill" md="live_tv" />
        <NativeTabs.Trigger.Label>Live 2</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="live-3" hidden={!ch3Live}>
        <NativeTabs.Trigger.Icon sf="video.fill" md="live_tv" />
        <NativeTabs.Trigger.Label>Live 3</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="wallet">
        <NativeTabs.Trigger.Icon sf="wallet.pass.fill" md="account_balance_wallet" />
        <NativeTabs.Trigger.Label>Wallet</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Icon sf="line.horizontal.3" md="menu" />
        <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
