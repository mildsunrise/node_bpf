import { MapType } from '../enums'

export interface MapDesc {
	type: MapType
	keySize: number
	valueSize: number
	maxEntries: number
	/** Flags specified on map creation, see [[MapFlags]] */
	flags: number
}

export interface TypeConversion<X> {
	parse(x: Buffer): X
	format(x: X): Buffer
}

export class OptionalTypeConversion<X> {
	private readonly type: TypeConversion<X>
	constructor(type: TypeConversion<X>) {
		this.type = type
	}

	parse(x: Buffer): X
	parse(x: Buffer | undefined): X | undefined
	parse(x: Buffer | undefined): X | undefined {
		return x === undefined ? undefined : this.type.parse(x)
	}

	format(x: X): Buffer
	format(x: X | undefined): Buffer | undefined
	format(x: X | undefined): Buffer | undefined {
			return x === undefined ? undefined : this.type.format(x)
	}
}
