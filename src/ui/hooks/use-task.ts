import type { Moment } from "moment";
import { derived, get, Readable } from "svelte/store";

import { roundToSnapStep, snap } from "../../global-stores/settings-utils";
import type { PlacedPlanItem, PlanItem } from "../../types";
import { getRelationToNow } from "../../util/moment";

import { useColor } from "./use-color";
import type { ReactiveSettingsWithUtils } from "./use-drag";
import { useDrag } from "./use-drag";
import { useResize } from "./use-resize";

interface UseTaskProps {
  settings: ReactiveSettingsWithUtils;
  currentTime: Readable<Moment>;
  cursorOffsetY: Readable<number>;
  onUpdate: (planItem: PlanItem) => Promise<void>;
  onMouseUp: (planItem: PlanItem) => Promise<void>;
}

export function useTask(
  task: PlacedPlanItem,
  { settings, currentTime, cursorOffsetY, onUpdate, onMouseUp }: UseTaskProps,
) {
  const { dragging, ...useDragValues } = useDrag({
    settings,
    cursorOffsetY,
    task,
    onUpdate,
  });

  const { resizing, ...useResizeValues } = useResize({
    settings,
    task,
    cursorOffsetY,
    onUpdate,
  });

  // todo: settings.settings is lame
  const useColorValues = useColor({ settings: settings.settings, task });

  const initialOffset = derived(
    // todo: not sure if this is the cleanest way
    [settings.settings, settings.hiddenHoursSize],
    ([$settings, $hiddenHoursSize]) => {
      return task.startMinutes * $settings.zoomLevel - $hiddenHoursSize;
    },
  );

  const offset = derived(
    [dragging, initialOffset, cursorOffsetY, settings.settings],
    ([$dragging, $initialOffset, $cursorOffsetY, $settings]) => {
      if (task.isGhost || $dragging) {
        return snap(Math.floor($cursorOffsetY), $settings.zoomLevel);
      }

      return $initialOffset;
    },
  );

  const initialHeight = derived([settings.settings], ([$settings]) => {
    return task.durationMinutes * $settings.zoomLevel;
  });

  const height = derived(
    [resizing, initialHeight, offset, cursorOffsetY],
    ([$resizing, $initialHeight, $offset, $cursorOffsetY]) => {
      if ($resizing) {
        const fromTaskStartToCursor = $cursorOffsetY - $offset;

        // todo: implicit dep on import?
        // todo: snap
        return roundToSnapStep(Math.floor(fromTaskStartToCursor));
      }

      return $initialHeight;
    },
  );

  const relationToNow = derived([currentTime], ([$currentTime]) => {
    return getRelationToNow($currentTime, task.startTime, task.endTime);
  });

  async function handleMouseUp() {
    if (task.isGhost || get(dragging)) {
      return;
    }

    await onMouseUp(task);
  }

  return {
    offset,
    height,
    relationToNow,
    dragging,
    handleMouseUp,
    ...useDragValues,
    ...useResizeValues,
    ...useColorValues,
  };
}
