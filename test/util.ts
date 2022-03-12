import { versions } from '../lib'

export const sortKeys = (x: Iterable<[number, number]>) => [...x].sort((a, b) => a[0] - b[0])
export const concat = <T>(...items: T[][]): T[] => ([] as T[]).concat.apply([], items)

export const conditionalTest = (condition: boolean, ...args: Parameters<typeof it>) =>
    condition ? it(...args) : it.skip(...args)

const parseVersion = (version: string) => {
    const m = /^(\d{1,3})\.(\d{1,3})(?:\.(\d{1,3})(?:-([\w-]+))?)?$/.exec(version)
    if (!m)
        throw Error(`Cannot parse kernel version «${version}»`)
    return 1000000 * Number(m[1]) + 1000 * Number(m[2]) + Number(m[3] || 0)
}
const kernelVersion = parseVersion(versions.kernel)
export const kernelAtLeast = (version: string) => kernelVersion >= parseVersion(version)

export const isRoot = process.getuid() === 0
