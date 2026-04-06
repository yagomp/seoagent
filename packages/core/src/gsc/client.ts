import { type searchconsole_v1 } from "googleapis";

export function formatDateForGsc(date: Date): string {
  return date.toISOString().split("T")[0];
}

export interface QueryParamsInput {
  dimensions: string[];
  days?: number;
  startDate?: string;
  endDate?: string;
  rowLimit?: number;
  queryFilter?: string;
  pageFilter?: string;
}

export interface QueryParams {
  siteUrl: string;
  requestBody: {
    startDate: string;
    endDate: string;
    dimensions: string[];
    rowLimit: number;
    dimensionFilterGroups?: {
      filters: {
        dimension: string;
        operator: string;
        expression: string;
      }[];
    }[];
  };
}

export function buildQueryParams(
  siteUrl: string,
  input: QueryParamsInput
): QueryParams {
  let startDate: string;
  let endDate: string;

  if (input.startDate && input.endDate) {
    startDate = input.startDate;
    endDate = input.endDate;
  } else {
    const days = input.days ?? 28;
    const end = new Date();
    end.setDate(end.getDate() - 3); // GSC data has ~3 day lag
    const start = new Date(end);
    start.setDate(start.getDate() - days);

    startDate = formatDateForGsc(start);
    endDate = formatDateForGsc(end);
  }

  const filters: { dimension: string; operator: string; expression: string }[] =
    [];

  if (input.queryFilter) {
    filters.push({
      dimension: "query",
      operator: "contains",
      expression: input.queryFilter,
    });
  }

  if (input.pageFilter) {
    filters.push({
      dimension: "page",
      operator: "contains",
      expression: input.pageFilter,
    });
  }

  const requestBody: QueryParams["requestBody"] = {
    startDate,
    endDate,
    dimensions: input.dimensions,
    rowLimit: input.rowLimit ?? 1000,
  };

  if (filters.length > 0) {
    requestBody.dimensionFilterGroups = [{ filters }];
  }

  return { siteUrl, requestBody };
}

export async function executeGscQuery(
  client: searchconsole_v1.Searchconsole,
  params: QueryParams
): Promise<searchconsole_v1.Schema$ApiDataRow[]> {
  const response = await client.searchanalytics.query({
    siteUrl: params.siteUrl,
    requestBody: params.requestBody,
  });

  return response.data.rows ?? [];
}
