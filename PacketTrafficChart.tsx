import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { SecurityLog, SecurityStatus } from '../types';

export interface PacketMetricPoint {
  id: string;
  timestamp: Date;
  incomingVolume: number; // Packets / second
  blockedVolume: number;  // Blocked / dropped packets per second
  threatCount: number;    // Malicious signatures caught
  sampleTimeStr: string;
}

interface PacketTrafficChartProps {
  theme?: 'dark' | 'light';
  stealthMode?: boolean;
  latestLog?: SecurityLog | null;
  onNavigateToLogs?: () => void;
}

export const PacketTrafficChart: React.FC<PacketTrafficChartProps> = ({
  theme = 'dark',
  stealthMode = false,
  latestLog,
  onNavigateToLogs,
}) => {
  const isLight = theme === 'light';
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Chart configuration & toggle state
  const [timeWindowSec, setTimeWindowSec] = useState<30 | 60 | 120>(60);
  const [isLiveActive, setIsLiveActive] = useState<boolean>(true);
  const [showIncoming, setShowIncoming] = useState<boolean>(true);
  const [showBlocked, setShowBlocked] = useState<boolean>(true);
  const [showAreaGradients, setShowAreaGradients] = useState<boolean>(true);
  const [hoveredPoint, setHoveredPoint] = useState<PacketMetricPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Initial seed data generator: 60 past points
  const generateInitialData = (): PacketMetricPoint[] => {
    const points: PacketMetricPoint[] = [];
    const now = Date.now();
    const count = 60;
    const intervalMs = 1000;

    for (let i = count - 1; i >= 0; i--) {
      const time = new Date(now - i * intervalMs);
      // Realistic baseline variance
      const baseIncoming = 2400 + Math.sin(i / 4) * 500 + Math.random() * 400;
      const baseBlocked = 65 + Math.cos(i / 3) * 35 + (Math.random() > 0.85 ? 120 : Math.random() * 25);
      points.push({
        id: `pt-${time.getTime()}`,
        timestamp: time,
        incomingVolume: Math.round(Math.max(800, baseIncoming)),
        blockedVolume: Math.round(Math.max(10, baseBlocked)),
        threatCount: Math.random() > 0.8 ? 1 : 0,
        sampleTimeStr: time.toLocaleTimeString(),
      });
    }
    return points;
  };

  const [data, setData] = useState<PacketMetricPoint[]>(generateInitialData);

  // Live interval to simulate continuous high-frequency packet telemetry
  useEffect(() => {
    if (!isLiveActive) return;

    const timer = setInterval(() => {
      setData(prev => {
        const now = new Date();
        const last = prev[prev.length - 1];
        const lastIncoming = last ? last.incomingVolume : 2600;
        const lastBlocked = last ? last.blockedVolume : 80;

        // Realistic packet fluctuation with random walk and mean reversion
        const deltaIncoming = (Math.random() - 0.5) * 450 + (2500 - lastIncoming) * 0.15;
        const nextIncoming = Math.max(900, Math.min(6500, Math.round(lastIncoming + deltaIncoming)));

        const deltaBlocked = (Math.random() - 0.5) * 45 + (75 - lastBlocked) * 0.18;
        const nextBlocked = Math.max(8, Math.min(850, Math.round(lastBlocked + deltaBlocked)));

        const newPoint: PacketMetricPoint = {
          id: `pt-${now.getTime()}`,
          timestamp: now,
          incomingVolume: nextIncoming,
          blockedVolume: nextBlocked,
          threatCount: Math.random() > 0.85 ? 1 : 0,
          sampleTimeStr: now.toLocaleTimeString(),
        };

        // Keep maximum 150 points in memory
        return [...prev.slice(-140), newPoint];
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLiveActive]);

  // React to external incoming logs from dashboard to cause realistic reactive spikes
  useEffect(() => {
    if (!latestLog) return;

    setData(prev => {
      const now = new Date();
      const isThreat = latestLog.status === SecurityStatus.THREAT_DETECTED;
      const isBlocked = latestLog.status === SecurityStatus.BLOCKED;

      // Spikes incoming and blocked depending on incident
      const spikeIncoming = isThreat ? 4800 + Math.floor(Math.random() * 1200) : isBlocked ? 3600 + Math.floor(Math.random() * 600) : 2900;
      const spikeBlocked = isThreat ? 450 + Math.floor(Math.random() * 250) : isBlocked ? 220 + Math.floor(Math.random() * 110) : 70;

      const reactionPoint: PacketMetricPoint = {
        id: `pt-${now.getTime()}-react`,
        timestamp: now,
        incomingVolume: spikeIncoming,
        blockedVolume: spikeBlocked,
        threatCount: isThreat ? 2 : isBlocked ? 1 : 0,
        sampleTimeStr: now.toLocaleTimeString(),
      };

      return [...prev.slice(-140), reactionPoint];
    });
  }, [latestLog]);

  // Trigger test traffic spike
  const triggerTrafficSpike = (type: 'burst' | 'threat_surge') => {
    setData(prev => {
      const now = new Date();
      const isSurge = type === 'threat_surge';
      const spikePoint: PacketMetricPoint = {
        id: `pt-spike-${now.getTime()}`,
        timestamp: now,
        incomingVolume: isSurge ? 5850 : 4200,
        blockedVolume: isSurge ? 680 : 310,
        threatCount: isSurge ? 4 : 1,
        sampleTimeStr: now.toLocaleTimeString(),
      };
      return [...prev.slice(-140), spikePoint];
    });
  };

  // Filter visible points according to selected time window
  const visibleData = useMemo(() => {
    const pointsCount = timeWindowSec;
    return data.slice(-pointsCount);
  }, [data, timeWindowSec]);

  // Real-time aggregates
  const stats = useMemo(() => {
    if (visibleData.length === 0) {
      return { currentIncoming: 0, currentBlocked: 0, peakIncoming: 0, avgBlockRatio: 0, totalPackets: 0, totalBlocked: 0 };
    }
    const latest = visibleData[visibleData.length - 1];
    const peakIncoming = Math.max(...visibleData.map(d => d.incomingVolume));
    const totalPackets = visibleData.reduce((acc, d) => acc + d.incomingVolume, 0);
    const totalBlocked = visibleData.reduce((acc, d) => acc + d.blockedVolume, 0);
    const avgBlockRatio = totalPackets > 0 ? (totalBlocked / totalPackets) * 100 : 0;

    return {
      currentIncoming: latest.incomingVolume,
      currentBlocked: latest.blockedVolume,
      peakIncoming,
      avgBlockRatio,
      totalPackets,
      totalBlocked,
    };
  }, [visibleData]);

  // D3 Rendering Hook
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || visibleData.length < 2) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const containerRect = containerRef.current.getBoundingClientRect();
    const width = Math.max(320, containerRect.width);
    const height = 280;

    const margin = { top: 28, right: 64, bottom: 35, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) return;

    // Define defs and gradients
    const defs = svg.append('defs');

    // Cyan gradient for incoming packets
    const incomingGradient = defs.append('linearGradient')
      .attr('id', 'incoming-packet-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    incomingGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#06b6d4')
      .attr('stop-opacity', isLight ? 0.35 : 0.45);

    incomingGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#06b6d4')
      .attr('stop-opacity', 0.0);

    // Rose gradient for blocked activity
    const blockedGradient = defs.append('linearGradient')
      .attr('id', 'blocked-packet-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    blockedGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#f43f5e')
      .attr('stop-opacity', isLight ? 0.35 : 0.45);

    blockedGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#f43f5e')
      .attr('stop-opacity', 0.0);

    // Glowing drop shadow filters
    const filter = defs.append('filter')
      .attr('id', 'glow-cyan')
      .attr('x', '-20%')
      .attr('y', '-20%')
      .attr('width', '140%')
      .attr('height', '140%');
    filter.append('feGaussianBlur').attr('stdDeviation', '2').attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const chartGroup = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X Scale (Time)
    const timeExtent = d3.extent<PacketMetricPoint, Date>(visibleData, d => d.timestamp) as [Date, Date];
    const xScale = d3.scaleTime()
      .domain(timeExtent)
      .range([0, innerWidth]);

    // Y1 Scale (Incoming Volume - Left Axis)
    const maxIncoming = d3.max<PacketMetricPoint, number>(visibleData, d => d.incomingVolume) || 4000;
    const yIncomingScale = d3.scaleLinear()
      .domain([0, maxIncoming * 1.15])
      .range([innerHeight, 0])
      .nice();

    // Y2 Scale (Blocked Volume - Right Axis)
    const maxBlocked = d3.max<PacketMetricPoint, number>(visibleData, d => d.blockedVolume) || 200;
    const yBlockedScale = d3.scaleLinear()
      .domain([0, Math.max(100, maxBlocked * 1.3)])
      .range([innerHeight, 0])
      .nice();

    // Subtle background horizontal grid lines
    const gridGroup = chartGroup.append('g').attr('class', 'grid-lines');
    const yTicks = yIncomingScale.ticks(5);
    gridGroup.selectAll('line.grid-h')
      .data(yTicks)
      .enter()
      .append('line')
      .attr('class', 'grid-h')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => yIncomingScale(d))
      .attr('y2', d => yIncomingScale(d))
      .attr('stroke', isLight ? '#e2e8f0' : '#1e293b')
      .attr('stroke-dasharray', '2,4')
      .attr('stroke-width', 1);

    // D3 Area generators
    if (showAreaGradients) {
      if (showIncoming) {
        const areaIncoming = d3.area<PacketMetricPoint>()
          .x(d => xScale(d.timestamp))
          .y0(innerHeight)
          .y1(d => yIncomingScale(d.incomingVolume))
          .curve(d3.curveMonotoneX);

        chartGroup.append('path')
          .datum(visibleData)
          .attr('fill', 'url(#incoming-packet-gradient)')
          .attr('d', areaIncoming);
      }

      if (showBlocked) {
        const areaBlocked = d3.area<PacketMetricPoint>()
          .x(d => xScale(d.timestamp))
          .y0(innerHeight)
          .y1(d => yBlockedScale(d.blockedVolume))
          .curve(d3.curveMonotoneX);

        chartGroup.append('path')
          .datum(visibleData)
          .attr('fill', 'url(#blocked-packet-gradient)')
          .attr('d', areaBlocked);
      }
    }

    // D3 Line generators
    if (showIncoming) {
      const lineIncoming = d3.line<PacketMetricPoint>()
        .x(d => xScale(d.timestamp))
        .y(d => yIncomingScale(d.incomingVolume))
        .curve(d3.curveMonotoneX);

      chartGroup.append('path')
        .datum(visibleData)
        .attr('fill', 'none')
        .attr('stroke', '#06b6d4')
        .attr('stroke-width', 2.25)
        .attr('filter', 'url(#glow-cyan)')
        .attr('d', lineIncoming);
    }

    if (showBlocked) {
      const lineBlocked = d3.line<PacketMetricPoint>()
        .x(d => xScale(d.timestamp))
        .y(d => yBlockedScale(d.blockedVolume))
        .curve(d3.curveMonotoneX);

      chartGroup.append('path')
        .datum(visibleData)
        .attr('fill', 'none')
        .attr('stroke', '#f43f5e')
        .attr('stroke-width', 2.25)
        .attr('stroke-dasharray', showIncoming ? 'none' : 'none')
        .attr('d', lineBlocked);
    }

    // Threats markers (points where high severity threat was detected)
    const threatPoints = visibleData.filter(d => d.threatCount > 0);
    chartGroup.selectAll<SVGCircleElement, PacketMetricPoint>('circle.threat-marker')
      .data(threatPoints)
      .enter()
      .append('circle')
      .attr('class', 'threat-marker')
      .attr('cx', (d: PacketMetricPoint) => xScale(d.timestamp))
      .attr('cy', (d: PacketMetricPoint) => yBlockedScale(d.blockedVolume))
      .attr('r', 4.5)
      .attr('fill', '#f43f5e')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5);

    // Animated 'Live Stream' Pulse Effect on Current Incoming Data Point
    const latestPoint = visibleData[visibleData.length - 1];
    if (latestPoint) {
      const latestX = xScale(latestPoint.timestamp);
      const latestYIncoming = yIncomingScale(latestPoint.incomingVolume);
      const latestYBlocked = yBlockedScale(latestPoint.blockedVolume);

      const isHighThreat =
        latestPoint.threatCount > 0 || latestPoint.blockedVolume >= 220;
      const isElevated = !isHighThreat && latestPoint.blockedVolume >= 120;

      const streamColor = isHighThreat
        ? '#f43f5e'
        : isElevated
        ? '#f59e0b'
        : '#06b6d4';
      const pulseDur = isHighThreat ? '0.9s' : isElevated ? '1.15s' : '1.5s';
      const pulseMaxR = isHighThreat ? 26 : 19;

      // Vertical live-edge guide at the active streaming point
      chartGroup
        .append('line')
        .attr('x1', latestX)
        .attr('x2', latestX)
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', streamColor)
        .attr('stroke-width', 1)
        .attr('stroke-opacity', 0.28)
        .attr('stroke-dasharray', '2,3');

      if (showIncoming) {
        const incomingLiveGroup = chartGroup
          .append('g')
          .attr('class', 'live-stream-pulse-incoming')
          .attr('transform', `translate(${latestX},${latestYIncoming})`);

        if (isLiveActive) {
          // Outer sonar wave 1
          const ring1 = incomingLiveGroup
            .append('circle')
            .attr('r', 5)
            .attr('fill', streamColor)
            .attr('fill-opacity', 0.35)
            .attr('stroke', streamColor)
            .attr('stroke-width', 1.5);

          ring1
            .append('animate')
            .attr('attributeName', 'r')
            .attr('from', '5')
            .attr('to', String(pulseMaxR))
            .attr('dur', pulseDur)
            .attr('repeatCount', 'indefinite');
          ring1
            .append('animate')
            .attr('attributeName', 'opacity')
            .attr('from', '0.85')
            .attr('to', '0')
            .attr('dur', pulseDur)
            .attr('repeatCount', 'indefinite');

          // Secondary delayed sonar wave 2 for continuous threat heartbeat
          const ring2 = incomingLiveGroup
            .append('circle')
            .attr('r', 5)
            .attr('fill', 'none')
            .attr('stroke', streamColor)
            .attr('stroke-width', 1.25);

          ring2
            .append('animate')
            .attr('attributeName', 'r')
            .attr('from', '5')
            .attr('to', String(pulseMaxR + 4))
            .attr('dur', pulseDur)
            .attr('begin', isHighThreat ? '0.35s' : '0.6s')
            .attr('repeatCount', 'indefinite');
          ring2
            .append('animate')
            .attr('attributeName', 'opacity')
            .attr('from', '0.75')
            .attr('to', '0')
            .attr('dur', pulseDur)
            .attr('begin', isHighThreat ? '0.35s' : '0.6s')
            .attr('repeatCount', 'indefinite');
        }

        // Core active node
        const coreDot = incomingLiveGroup
          .append('circle')
          .attr('r', isHighThreat ? 5.5 : 4.5)
          .attr('fill', streamColor)
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1.8)
          .attr('filter', 'url(#glow-cyan)');

        if (isLiveActive) {
          coreDot
            .append('animate')
            .attr('attributeName', 'r')
            .attr('values', isHighThreat ? '5;7;5' : '4;5.5;4')
            .attr('dur', pulseDur)
            .attr('repeatCount', 'indefinite');
        }

        // Compact live-edge readout tag anchored cleanly inside plot area
        if (isHighThreat || isElevated) {
          incomingLiveGroup
            .append('text')
            .attr('x', -10)
            .attr('y', latestYIncoming < 24 ? 16 : -12)
            .attr('text-anchor', 'end')
            .attr('fill', streamColor)
            .attr('font-size', '10px')
            .attr('font-weight', '700')
            .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
            .text(
              isHighThreat
                ? `THREAT PULSE · ${latestPoint.blockedVolume} blks/s`
                : `ELEVATED · ${latestPoint.blockedVolume} blks/s`
            );
        }
      }

      if (showBlocked) {
        const blockedLiveGroup = chartGroup
          .append('g')
          .attr('class', 'live-stream-pulse-blocked')
          .attr('transform', `translate(${latestX},${latestYBlocked})`);

        if (isLiveActive) {
          const blockedRing = blockedLiveGroup
            .append('circle')
            .attr('r', 4)
            .attr('fill', '#f43f5e')
            .attr('fill-opacity', 0.3)
            .attr('stroke', '#f43f5e')
            .attr('stroke-width', 1.25);

          blockedRing
            .append('animate')
            .attr('attributeName', 'r')
            .attr('from', '4')
            .attr('to', isHighThreat ? '22' : '15')
            .attr('dur', pulseDur)
            .attr('repeatCount', 'indefinite');
          blockedRing
            .append('animate')
            .attr('attributeName', 'opacity')
            .attr('from', '0.85')
            .attr('to', '0')
            .attr('dur', pulseDur)
            .attr('repeatCount', 'indefinite');
        }

        blockedLiveGroup
          .append('circle')
          .attr('r', isHighThreat ? 5 : 4)
          .attr('fill', '#f43f5e')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1.5);
      }
    }

    // Axes styling
    const xAxis = d3.axisBottom<Date>(xScale)
      .ticks(Math.max(3, Math.floor(innerWidth / 110)))
      .tickFormat(d => d3.timeFormat('%H:%M:%S')(d as Date));

    const yAxisLeft = d3.axisLeft(yIncomingScale)
      .ticks(5)
      .tickFormat(d => `${d3.format('.1s')(d as number)}/s`);

    const yAxisRight = d3.axisRight(yBlockedScale)
      .ticks(5)
      .tickFormat(d => `${d3.format('.0f')(d as number)}/s`);

    // Render X Axis
    const gx = chartGroup.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);
    gx.select('.domain').attr('stroke', isLight ? '#cbd5e1' : '#334155');
    gx.selectAll('.tick line').attr('stroke', isLight ? '#cbd5e1' : '#334155');
    gx.selectAll('.tick text')
      .attr('fill', isLight ? '#64748b' : '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-family', 'ui-monospace, SFMono-Regular, monospace');

    // Render Left Y Axis (Incoming Packets)
    if (showIncoming) {
      const gyLeft = chartGroup.append('g').call(yAxisLeft);
      gyLeft.select('.domain').remove();
      gyLeft.selectAll('.tick line').remove();
      gyLeft.selectAll('.tick text')
        .attr('fill', '#06b6d4')
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace');

      // Left Axis Label
      chartGroup.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -45)
        .attr('x', -innerHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#06b6d4')
        .attr('font-size', '10px')
        .attr('font-weight', '600')
        .text('Incoming Packets');
    }

    // Render Right Y Axis (Blocked Activity)
    if (showBlocked) {
      const gyRight = chartGroup.append('g')
        .attr('transform', `translate(${innerWidth},0)`)
        .call(yAxisRight);
      gyRight.select('.domain').remove();
      gyRight.selectAll('.tick line').remove();
      gyRight.selectAll('.tick text')
        .attr('fill', '#f43f5e')
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace');

      // Right Axis Label
      chartGroup.append('text')
        .attr('transform', 'rotate(90)')
        .attr('y', -innerWidth - 42)
        .attr('x', innerHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#f43f5e')
        .attr('font-size', '10px')
        .attr('font-weight', '600')
        .text('Blocked Rate');
    }

    // Interactive Hover Overlay & Crosshair
    const bisectDate = d3.bisector<PacketMetricPoint, Date>(d => d.timestamp).left;

    const crosshair = chartGroup.append('g')
      .attr('class', 'crosshair')
      .style('display', 'none');

    // Vertical guide line
    crosshair.append('line')
      .attr('class', 'crosshair-line')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', isLight ? '#64748b' : '#94a3b8')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '3,3');

    // Dot on incoming line
    const incomingDot = crosshair.append('circle')
      .attr('r', 4.5)
      .attr('fill', '#06b6d4')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5);

    // Dot on blocked line
    const blockedDot = crosshair.append('circle')
      .attr('r', 4.5)
      .attr('fill', '#f43f5e')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5);

    // Invisible mouse tracking rect
    chartGroup.append('rect')
      .attr('class', 'mouse-catcher')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mouseenter', () => crosshair.style('display', null))
      .on('mouseleave', () => {
        crosshair.style('display', 'none');
        setHoveredPoint(null);
        setTooltipPos(null);
      })
      .on('mousemove', (event: MouseEvent) => {
        const [pointerX] = d3.pointer(event);
        const xDate = xScale.invert(pointerX);
        const index = bisectDate(visibleData, xDate, 1);
        const d0 = visibleData[index - 1];
        const d1 = visibleData[index];
        let chosen = d0;
        if (d0 && d1) {
          chosen = xDate.getTime() - d0.timestamp.getTime() > d1.timestamp.getTime() - xDate.getTime() ? d1 : d0;
        } else if (d1) {
          chosen = d1;
        }

        if (chosen) {
          const cx = xScale(chosen.timestamp);
          const cyIncoming = yIncomingScale(chosen.incomingVolume);
          const cyBlocked = yBlockedScale(chosen.blockedVolume);

          crosshair.select('.crosshair-line').attr('transform', `translate(${cx},0)`);
          incomingDot.attr('transform', `translate(${cx},${cyIncoming})`).style('display', showIncoming ? null : 'none');
          blockedDot.attr('transform', `translate(${cx},${cyBlocked})`).style('display', showBlocked ? null : 'none');

          setHoveredPoint(chosen);
          setTooltipPos({
            x: margin.left + cx,
            y: margin.top + Math.min(cyIncoming, cyBlocked),
          });
        }
      });
  }, [visibleData, isLight, showIncoming, showBlocked, showAreaGradients, isLiveActive]);

  return (
    <div
      ref={containerRef}
      className={`glass rounded-2xl border p-6 transition-all duration-300 shadow-cyan ${
        isLight ? 'border-slate-200 bg-white/90' : 'border-slate-800 bg-slate-900/60'
      }`}
    >
      {/* Top Header & Interactive Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-tight">Real-Time Packet Volume & Block Activity</h3>
                <span className="text-[10px] mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${isLiveActive ? 'bg-cyan-400 animate-ping' : 'bg-slate-500'}`} />
                  {isLiveActive ? 'D3.js Live Stream' : 'Stream Paused'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                High-frequency vector telemetry of incoming packet ingress versus proactive firewall & DNS sinkhole drops
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Layer Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Incoming Toggle */}
          <button
            type="button"
            onClick={() => setShowIncoming(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              showIncoming
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400'
                : 'bg-slate-100 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700 text-slate-500'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Incoming Packets</span>
          </button>

          {/* Blocked Toggle */}
          <button
            type="button"
            onClick={() => setShowBlocked(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              showBlocked
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                : 'bg-slate-100 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700 text-slate-500'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Block Activity</span>
          </button>

          {/* Area Gradients Toggle */}
          <button
            type="button"
            onClick={() => setShowAreaGradients(prev => !prev)}
            title="Toggle gradient area fills"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              showAreaGradients
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                : 'bg-transparent text-slate-500 border-dashed border-slate-300 dark:border-slate-700'
            }`}
          >
            Area Fill
          </button>

          {/* Time Window Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700">
            {( [30, 60, 120] as const).map(sec => (
              <button
                key={sec}
                type="button"
                onClick={() => setTimeWindowSec(sec)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                  timeWindowSec === sec
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>

          {/* Play / Pause Toggle */}
          <button
            type="button"
            onClick={() => setIsLiveActive(prev => !prev)}
            className={`p-2 rounded-lg border text-xs font-bold transition-all ${
              isLiveActive
                ? 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
            }`}
            title={isLiveActive ? 'Pause real-time telemetry feed' : 'Resume real-time telemetry feed'}
          >
            {isLiveActive ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>

          {/* Simulation Spike Buttons */}
          <button
            type="button"
            onClick={() => triggerTrafficSpike('burst')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 transition-colors whitespace-nowrap"
          >
            + Test Spike
          </button>

          <button
            type="button"
            onClick={() => triggerTrafficSpike('threat_surge')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600/15 hover:bg-rose-600/25 text-rose-400 border border-rose-500/30 transition-colors whitespace-nowrap"
          >
            + Threat Surge
          </button>
        </div>
      </div>

      {/* Real-time KPI Metric Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
        {/* Metric 1: Current Inbound Volume */}
        <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/40 border-slate-800'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inbound Rate</span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black mono text-cyan-400 tabular-nums">
              {stealthMode ? `0x${stats.currentIncoming.toString(16)}` : stats.currentIncoming.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">pkts/s</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">Peak: {stats.peakIncoming.toLocaleString()} pkts/s</span>
        </div>

        {/* Metric 2: Real-time Block Activity */}
        <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/40 border-slate-800'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Blocked Rate</span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black mono text-rose-500 tabular-nums">
              {stealthMode ? `0x${stats.currentBlocked.toString(16)}` : stats.currentBlocked.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">blks/s</span>
          </div>
          <span className="text-[10px] text-rose-400/80 block mt-0.5 font-medium">Auto-Sinkholed & Dropped</span>
        </div>

        {/* Metric 3: Drop Efficiency Ratio */}
        <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/40 border-slate-800'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Drop Ratio</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black mono text-emerald-400 tabular-nums">
              {stats.avgBlockRatio.toFixed(2)}%
            </span>
            <span className="text-[11px] text-slate-500 font-medium">filtration</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">Zero Malicious Leakage</span>
        </div>

        {/* Metric 4: Rolling Total Packets Handled */}
        <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/40 border-slate-800'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{timeWindowSec}s Total Filtered</span>
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black mono text-purple-400 tabular-nums">
              {stats.totalBlocked.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">threats</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">{stats.totalPackets.toLocaleString()} total verified</span>
        </div>
      </div>

      {/* D3 Canvas Container */}
      <div className="relative w-full overflow-hidden rounded-xl border border-slate-200/50 dark:border-slate-800/80 bg-slate-950/20 dark:bg-black/40">
        <svg
          ref={svgRef}
          className="w-full h-[280px] overflow-visible block"
        />

        {/* Interactive D3 Hover Tooltip */}
        {hoveredPoint && tooltipPos && (
          <div
            className={`pointer-events-none absolute z-20 px-3.5 py-2.5 rounded-xl border shadow-xl backdrop-blur-md transition-opacity duration-150 ${
              isLight
                ? 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/40'
                : 'bg-slate-900/95 border-slate-700 text-white shadow-black/60'
            }`}
            style={{
              left: Math.min(Math.max(10, tooltipPos.x - 90), (containerRef.current?.clientWidth || 400) - 190),
              top: Math.max(10, tooltipPos.y - 85),
            }}
          >
            <div className="text-[11px] font-mono font-bold text-slate-400 border-b border-slate-700/40 pb-1 mb-1.5 flex items-center justify-between gap-3">
              <span>{hoveredPoint.sampleTimeStr}</span>
              {hoveredPoint.threatCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 text-[9px] font-bold">
                  {hoveredPoint.threatCount} Malicious
                </span>
              )}
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between gap-4 font-mono">
                <span className="text-cyan-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  Incoming:
                </span>
                <span className="font-bold tabular-nums">{hoveredPoint.incomingVolume.toLocaleString()} pkts/s</span>
              </div>
              <div className="flex items-center justify-between gap-4 font-mono">
                <span className="text-rose-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Blocked:
                </span>
                <span className="font-bold tabular-nums text-rose-400">{hoveredPoint.blockedVolume.toLocaleString()} blks/s</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-[10px] text-slate-400 pt-0.5">
                <span>Block Efficiency:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {((hoveredPoint.blockedVolume / hoveredPoint.incomingVolume) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chart Footer Meta & Direct Link to Logs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 mt-2 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-cyan-400 rounded-full" />
            <span className="text-[11px]">Primary Ingress (0 to {(stats.peakIncoming * 1.15).toFixed(0)} pkts/s)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-rose-500 rounded-full" />
            <span className="text-[11px]">Interception Drop Rate</span>
          </div>
        </div>

        {onNavigateToLogs && (
          <button
            type="button"
            onClick={onNavigateToLogs}
            className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 self-end sm:self-auto"
          >
            <span>View Full Packet Logs</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default PacketTrafficChart;
