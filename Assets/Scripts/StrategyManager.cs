using System.Collections.Generic;
using UnityEngine;

public class StrategyManager : MonoBehaviour
{
    public static StrategyManager Instance { get; private set; }
    public List<Cell> cells = new List<Cell>();
    public Cell startCell;
    public Cell endCell;
    public int width = 20;
    public int height = 20;
    private List<PathStrategy> strategies = new List<PathStrategy>();
    public PathStrategy currentStrategy;
    public PathStrategy globalStrategy;
    public StrategyManager()
    {
        Instance = this;
    }
    public void ApplyStrategy(PathStrategy strategy)
    {
        if (strategy == null)
        {
            ResetStrategy();
            return;
        }
        bool isFound = false;
        foreach (var s in strategies)
        {
            if (s == strategy)
            {
                isFound = true;
                currentStrategy = s;
            }
            else
            {
                s.SetEnable(false);
            }
        }
        if (!isFound)
        {
            strategies.Add(strategy);
            currentStrategy = strategy;
        }
        if (currentStrategy != null)
        {
            if (!currentStrategy.isInit)
            {
                currentStrategy.Init();
            }
            currentStrategy.SetEnable(true);
        }
    }

    public void ResetStrategy()
    {
        foreach (var s in strategies)
        {
            s.SetEnable(false);
        }
        if (globalStrategy != null)
        {
            ApplyStrategy(globalStrategy);
        }
    }

    public void SetGlobalStrategy(PathStrategy strategy)
    {
        globalStrategy = strategy;
    }

    public void InitCells()
    {
        foreach (var cell in cells)
        {
            cell.SetCellType(CellType.Normal);
        }
        startCell?.SetCellType(CellType.Normal);
        endCell?.SetCellType(CellType.Normal);
        startCell = null;
        endCell = null;
    }
}