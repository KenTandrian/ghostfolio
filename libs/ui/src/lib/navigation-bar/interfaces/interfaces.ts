interface BaseNavigationBarItem {
  iconName: string;
  label: string;
  showCondition?: boolean;
}

export type NavigationBarItem = BaseNavigationBarItem &
  (
    | { onClick: () => void; routerLink?: never }
    | { onClick?: never; routerLink: string[] }
  );
