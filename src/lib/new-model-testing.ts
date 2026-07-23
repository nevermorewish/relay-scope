export interface TestableMonitoredModel {
  id: number;
  modelName: string;
  enabled: boolean;
}

export interface NewModelTestResult {
  modelName: string;
  ok: boolean;
  error?: string;
}

export function findNewEnabledModels(
  previousModels: Array<{ modelName: string }> | undefined,
  savedModels: TestableMonitoredModel[] | undefined,
): TestableMonitoredModel[] {
  const previousNames = new Set((previousModels || []).map((model) => model.modelName.trim().toLowerCase()));
  return (savedModels || []).filter((model) => (
    model.enabled && !previousNames.has(model.modelName.trim().toLowerCase())
  ));
}

export async function runNewModelTests(
  keyId: number,
  models: TestableMonitoredModel[],
): Promise<NewModelTestResult[]> {
  const results: NewModelTestResult[] = [];
  for (const model of models) {
    try {
      const response = await fetch(`/api/keys/${keyId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monitoredModelId: model.id }),
      });
      const data = await response.json();
      results.push({
        modelName: model.modelName,
        ok: response.ok && data.modelTestOk !== false,
        error: response.ok ? undefined : data.error || data.errorMessage || '测试失败',
      });
    } catch (error) {
      results.push({ modelName: model.modelName, ok: false, error: (error as Error).message });
    }
  }
  return results;
}
