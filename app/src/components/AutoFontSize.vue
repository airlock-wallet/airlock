<!--
Copyright (C) 2026 Le Wang

This file is part of Airlock.

Airlock is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Airlock is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with Airlock.  If not, see <https://www.gnu.org/licenses/>.
-->

<template>
    <div ref="parent" class="fitty-parent">
        <div class="fitty-target">
            <slot></slot>
        </div>
    </div>
</template>
<script>
import fitty from 'fitty';
import {ref, onMounted, onUpdated, onBeforeUnmount, nextTick} from 'vue';

export default {
    name: 'FittyText',
    props: {
        minSize: {type: Number, default: 12},
        maxSize: {type: Number, default: 32},
    },
    setup(props) {
        const parent = ref(null);
        let fittyInstance = null;

        const redraw = () => {
            if (fittyInstance) fittyInstance.fit();
        };

        onMounted(async () => {
            if (!parent.value) return;

            // fitty(target, options)
            // Note: passing parent.value.firstChild (which is .fitty-target)
            fittyInstance = fitty(parent.value.firstChild, {
                minSize: props.minSize,
                maxSize: props.maxSize,
                multiLine: false
            });

            // Must wait for styles to apply before calculating
            await nextTick();

            redraw();
        });

        // Force recalculation on any update
        onUpdated(redraw);

        onBeforeUnmount(() => {
            if (fittyInstance) fittyInstance.unsubscribe();
        });

        return {parent};
    }
};
</script>
<style scoped>
.fitty-parent {
    display: inline-block;
    white-space: nowrap;
    max-width: 100%;
}

.fitty-target {
    display: inline-block;
    white-space: nowrap;
}
</style>