/** An identifier with an assigned value. */
export type Binding = {
  /** The name of the binding. */
  _name: string
  /** The value of the binding as a source string. */
  _source?: string
  /** Whether the binding has a dependency on another binding. */
  _hasDependency?: true
}

/** An mutation of a binding. */
export type Mutation = {
  /** The source of the mutation itself. */
  _source: string
  /**
   * What the mutation statement evaluates to when used as an expression.
   *
   * Undefined if it doesn't evaluate to anything worth mentioning.
   */
  _evaluatesTo?: string
}

/** State maintained while converting a value to source. */
export type State = {
  /**
   * A map from object to the binding where it should be stored.
   *
   * Bindings are used to share objects that are referenced multiple times or to
   * create circular references in conjunction with {@link State._mutations}.
   */
  _bindings: Map<object, Binding>

  /** A map from value to user provided custom source, or `null` for omitted. */
  _customSources: Map<unknown, string | null>

  /**
   * Parents objects that have already been visited above the current object
   * tree being traversed.
   *
   * Used to detect circular references.
   */
  _currentParents: Set<object>

  /**
   * The current binding being rendered, or `undefined` if an inline value is
   * being rendered (e.g. directly returned).
   */
  _currentBinding?: Binding

  /**
   * Bindings in the order they were first rendered, which is naturally
   * topological order since dependencies are always rendered before dependents.
   */
  _bindingOrder: Binding[]

  /** A list of mutations of bindings. */
  _mutations: Mutation[]

  /** A cache of information queried during traversal by object. */
  _cache: Map<
    object,
    {
      /** From {@link Object.keys}. */
      _keys?: string[]
      /** From {@link Reflect.ownKeys}. */
      _ownKeys?: (string | symbol)[]
      /** From {@link Object.getOwnPropertyDescriptor}. */
      _descriptors?: PropertyDescriptor[]
    }
  >
}

/** A function that unevals a value of type {@link Value}. */
export type Uneval<Value> = (value: Value, state: State, name: string) => string
