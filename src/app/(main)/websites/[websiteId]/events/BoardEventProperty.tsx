import { Column, Heading, Text } from '@umami/react-zen';
import { useMemo } from 'react';
import { PieChart } from '@/components/charts/PieChart';
import { LoadingPanel } from '@/components/common/LoadingPanel';
import { useMessages, usePropertySeriesQuery } from '@/components/hooks';
import { ListTable } from '@/components/metrics/ListTable';
import { CHART_COLORS, DATA_TYPE, OPERATORS } from '@/lib/constants';
import type { PropertyFilter } from '@/lib/types';

// Top values of one event property, e.g. event "view-musician" by property "name".
// An optional property filter narrows it, e.g. utm_medium = newsletter.
export function BoardEventProperty({
  websiteId,
  eventName,
  propertyName,
  filterProperty,
  filterValue,
  limit = 10,
}: {
  websiteId: string;
  eventName?: string;
  propertyName?: string;
  filterProperty?: string;
  filterValue?: string;
  limit?: number | string;
}) {
  const { t, labels } = useMessages();

  const propertyFilters = useMemo<PropertyFilter[]>(
    () =>
      filterProperty && filterValue
        ? [
            {
              propertyName: filterProperty,
              dataType: DATA_TYPE.string,
              operator: OPERATORS.equals,
              value: filterValue,
            },
          ]
        : [],
    [filterProperty, filterValue],
  );

  const { data, isLoading, isFetching, error } = usePropertySeriesQuery(
    'event',
    websiteId,
    propertyName ?? '',
    propertyFilters,
    eventName,
    { enabled: !!eventName && !!propertyName },
  );

  const items = useMemo(() => {
    if (!data) return [];
    const totals = data.reduce((obj: Record<string, number>, { x, y }) => {
      obj[x] = (obj[x] ?? 0) + y;
      return obj;
    }, {});
    const sorted = Object.entries(totals)
      .map(([label, count]) => ({ label, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, Number(limit) || 10);
    const total = sorted.reduce((sum, { count }) => sum + count, 0);
    return sorted.map(item => ({ ...item, percent: total ? (item.count / total) * 100 : 0 }));
  }, [data, limit]);

  if (!eventName || !propertyName) {
    return <Text color="muted">Set an event and property for this panel.</Text>;
  }

  const chartData = {
    labels: items.map(({ label }) => label),
    datasets: [
      {
        data: items.map(({ count }) => count),
        backgroundColor: CHART_COLORS,
        borderWidth: 0,
      },
    ],
  };

  return (
    <LoadingPanel
      data={items}
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      minHeight="300px"
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24,
          alignItems: 'start',
        }}
      >
        <Column style={{ minWidth: 0 }}>
          <Heading>
            <Text>
              {eventName} · {propertyName}
              {filterProperty && filterValue ? ` (${filterProperty} = ${filterValue})` : ''}
            </Text>
          </Heading>
          <ListTable metric={t(labels.count)} data={items} />
        </Column>
        <Column style={{ minWidth: 0, overflow: 'hidden' }}>
          <PieChart type="doughnut" chartData={chartData} height="280px" />
        </Column>
      </div>
    </LoadingPanel>
  );
}
