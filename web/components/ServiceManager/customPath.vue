<template>
  <el-dialog
    v-model="show"
    :title="$t('base.customVersionDir')"
    width="600px"
    :destroy-on-close="true"
    class="host-edit custom-path"
    @closed="closedFn"
  >
    <div class="main-wapper">
      <div class="plant-title">
        <span></span>
        <yb-icon
          :svg="import('@/svg/add.svg?raw')"
          class="add"
          width="18"
          height="18"
          @click="addDir(undefined)"
        />
      </div>
      <div class="main">
        <template v-for="(item, index) in dirs" :key="index">
          <div class="path-choose mb-20">
            <input type="text" class="input" placeholder="Document Root Directory" readonly="" :value="item" />
            <div class="icon-block">
              <yb-icon
                :svg="import('@/svg/folder.svg?raw')"
                class="choose"
                width="18"
                height="18"
                @click="chooseDir(index)"
              />
              <yb-icon
                :svg="import('@/svg/delete.svg?raw')"
                class="choose"
                width="19"
                height="19"
                @click="delDir(index)"
              />
            </div>
          </div>
        </template>
      </div>
    </div>
  </el-dialog>
</template>

<script lang="ts" setup>
  import { reactive, ref, watch, onBeforeUnmount, nextTick } from 'vue'
  import { AsyncComponentSetup } from '@web/fn'
  import { AppStore } from '@web/store/app'
  import { BrewStore } from '@web/store/brew'
  import type { AllAppModule } from '@web/core/type'

  const { show, onClosed, onSubmit, closedFn, callback } = AsyncComponentSetup()

  const props = defineProps<{
    flag: AllAppModule
  }>()

  const appStore = AppStore()
  const brewStore = BrewStore()

  const flag = props.flag
  const setupItem: any = appStore.config.setup
  if (!setupItem?.[flag]) {
    setupItem[flag] = reactive({
      dirs: []
    })
  }

  const dirs = ref(setupItem?.[flag]?.dirs ?? [])

  const changed = ref(false)

  watch(
    dirs,
    (v: any) => {
      changed.value = true
      nextTick().then(() => {
        if (!setupItem?.[flag]) {
          setupItem[flag] = reactive({
            dirs: []
          })
        }
        setupItem[flag].dirs = reactive(v)
        brewStore.module(flag).installedInited = false
      })
    },
    {
      deep: true
    }
  )

  const addDir = (index?: number) => {}
  const chooseDir = (index: number) => {
    addDir(index)
  }
  const delDir = (index: number) => {
    dirs.value.splice(index, 1)
  }

  onBeforeUnmount(() => {
    if (changed.value) {
      callback(true)
    }
  })

  defineExpose({
    show,
    onSubmit,
    onClosed
  })
</script>
