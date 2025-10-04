export interface Set {
    id: string;
    code: string;
    name: string;
    series: string;
    releaseDate: string;
    cardCount: number;
    isCurrent: boolean;
    lastUpdated?: string;
}

export interface GroupedSets {
    type: 'group';
    name: string;
    items: Set[];
}

export type SetOrGroup = Set | GroupedSets;
