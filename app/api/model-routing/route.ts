import { NextRequest, NextResponse } from 'next/server';
import {
    getModelRoutingConfig,
    setModelRoutingConfig,
    mergeModelRouting,
    validateModelRouting,
    DEFAULT_MODEL_ROUTING,
    type ModelRoutingConfig,
    type ModelTaskKey,
    type TaskModelConfig,
} from '@/lib/config/modelRouting';
import { loadConfigFromFile, saveConfigToFile } from '@/lib/config/modelRoutingPersistence';

// GET – return current model routing config
export async function GET() {
    let config = getModelRoutingConfig();

    // If using defaults, try loading from persisted file
    if (config === DEFAULT_MODEL_ROUTING) {
        const fileConfig = loadConfigFromFile();
        if (fileConfig) {
            setModelRoutingConfig(fileConfig);
            config = fileConfig;
        }
    }

    return NextResponse.json({ config, defaults: DEFAULT_MODEL_ROUTING });
}

// PUT – update model routing config (partial or full)
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const partial = body.config as Partial<Record<ModelTaskKey, Partial<TaskModelConfig>>>;

        if (!partial || typeof partial !== 'object') {
            return NextResponse.json(
                { error: 'Invalid config payload' },
                { status: 400 }
            );
        }

        // Merge with defaults
        const merged: ModelRoutingConfig = mergeModelRouting(partial);

        // Validate
        const validation = validateModelRouting(merged);
        if (!validation.isValid) {
            return NextResponse.json(
                { error: 'Validation failed', details: validation.errors },
                { status: 400 }
            );
        }

        // Store in runtime AND persist to file
        setModelRoutingConfig(merged);
        saveConfigToFile(merged);

        return NextResponse.json({ config: merged, ok: true });
    } catch (error) {
        console.error('Model routing update error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
