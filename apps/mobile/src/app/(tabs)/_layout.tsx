import React from 'react';
import { NativeTabs } from 'expo-router/native-tabs';
import { useChannelStatus } from '@/hooks/use-channel-status';

export default function TabsLayout() {
  const { ch2Live, ch3Live } = useChannelStatus();
  // Extra live channels take priority over Predictions in the tab bar.
  const hidePredictions = ch2Live || ch3Live;

  return (
    <NativeTabs minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="live">
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
      <NativeTabs.Trigger name="predictions" hidden={hidePredictions}>
        <NativeTabs.Trigger.Icon sf="sportscourt" md="sports_esports" />
        <NativeTabs.Trigger.Label>Predictions</NativeTabs.Trigger.Label>
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
