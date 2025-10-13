using System;
using System.Collections.Generic;
using Cysharp.Threading.Tasks;
using UnityEngine;

[CreateAssetMenu(fileName = "DFSGenMazeStrategy", menuName = "Strategy/DFSGenMazeStrategy", order = 0)]
public class DFSGenMazeStrategy : PathStrategy
{
    private List<Cell> cellList;
    private List<Cell> mazeCells;
    private HashSet<Cell> visitedCells;
    private int mazeCellWidth;
    private int mazeCellHeight;
    public int randomSeed = 0;
    public int delayTime = 200;
    private System.Random random;
    public override string Name()
    {
        return "DFS生成迷宫";
    }
    protected override void OnInit()
    {
        random = new System.Random(randomSeed);
        cellList = StrategyManager.Instance.cells;
        var width = StrategyManager.Instance.width;
        var height = StrategyManager.Instance.height;
        // 为了迷宫美观，确保宽度和高度都是奇数
        if (width % 2 == 0)
        {
            width++;
        }
        if (height % 2 == 0)
        {
            height++;
        }
        MainPanel.Instance.GenerateGrid(width, height);
        mazeCellWidth = (width + 1) >> 1;
        mazeCellHeight = (height + 1) >> 1;
        mazeCells = new List<Cell>(mazeCellWidth * mazeCellHeight);
        foreach (var cell in cellList)
        {
            if (cell.x % 2 == 1 || cell.y % 2 == 1)
            {
                cell.SetCellType(CellType.Wall);
            }
            else
            {
                cell.SetCellType(CellType.Normal);
                mazeCells.Add(cell);
            }
        }
        GenMaze().Forget();
    }

    public async UniTask GenMaze()
    {
        MainPanel.Instance.ShowMask(true);
        await GenMazeInternal();
        MainPanel.Instance.ShowMask(false);
    }

    private async UniTask GenMazeInternal()
    {
        visitedCells = new HashSet<Cell>();
        var firstCell = mazeCells[0];
        firstCell.SetCellType(CellType.Visited);
        visitedCells.Add(firstCell);
        var stack = new Stack<Cell>();
        Cell lastPopCell = null;
        stack.Push(firstCell);
        while (stack.Count > 0)
        {
            var peekCell = stack.Peek();
            var neighborCell = GetRandomNeighbor(peekCell);
            if (neighborCell != null)
            {
                if (lastPopCell != null)
                {
                    var wall = GetBetweenCellsWall(lastPopCell, peekCell);
                    wall.SetCellType(CellType.Normal);
                }
                neighborCell.SetCellType(CellType.Research);
                var betweenCellsWall = GetBetweenCellsWall(peekCell, neighborCell);
                if (betweenCellsWall != null)
                {
                    betweenCellsWall.SetCellType(CellType.Visited);
                }
                await UniTask.Delay(delayTime);
                neighborCell.SetCellType(CellType.Visited);
                visitedCells.Add(neighborCell);
                stack.Push(neighborCell);
                lastPopCell = null;
            }
            else
            {
                var popCell = stack.Pop();
                popCell.SetCellType(CellType.Normal);
                if (lastPopCell != null)
                {
                    var wall = GetBetweenCellsWall(lastPopCell, popCell);
                    wall.SetCellType(CellType.Normal);
                }
                lastPopCell = popCell;
            }
            await UniTask.Delay(delayTime);
        }
        await UniTask.CompletedTask;
        Debug.Log("GenMazeInternal done");
    }

    private Cell GetBetweenCellsWall(Cell cell1, Cell cell2)
    {
        int cell1RealIndex = cell1.x + cell1.y * StrategyManager.Instance.width;
        int cell2RealIndex = cell2.x + cell2.y * StrategyManager.Instance.width;
        int totalCells = StrategyManager.Instance.cells.Count;

        if (cell1.x == cell2.x)
        {
            if (cell1.y > cell2.y)
            {
                int wallIndex = cell2RealIndex + StrategyManager.Instance.width;
                if (wallIndex >= 0 && wallIndex < totalCells)
                    return StrategyManager.Instance.cells[wallIndex];
            }
            else
            {
                int wallIndex = cell1RealIndex + StrategyManager.Instance.width;
                if (wallIndex >= 0 && wallIndex < totalCells)
                    return StrategyManager.Instance.cells[wallIndex];
            }
        }
        else if (cell1.y == cell2.y)
        {
            if (cell1.x > cell2.x)
            {
                int wallIndex = cell2RealIndex + 1;
                if (wallIndex >= 0 && wallIndex < totalCells)
                    return StrategyManager.Instance.cells[wallIndex];
            }
            else
            {
                int wallIndex = cell1RealIndex + 1;
                if (wallIndex >= 0 && wallIndex < totalCells)
                    return StrategyManager.Instance.cells[wallIndex];
            }
        }
        else
        {
            // Debug.Log("两个格子不是相邻的");
            return null;
        }

        return null; // Return null if bounds check failed
    }

    private Cell GetRandomNeighbor(Cell cell)
    {
        int cellIndex = GetMazeCellIndex(cell);
        List<int> neighborIndexs = new List<int>(4);
        try
        {
            // Check top neighbor (up)
            int topIndex = cellIndex - mazeCellWidth;
            if (topIndex >= 0 && topIndex < mazeCells.Count && !visitedCells.Contains(mazeCells[topIndex]))
            {
                neighborIndexs.Add(topIndex);
            }

            // Check bottom neighbor (down)
            int bottomIndex = cellIndex + mazeCellWidth;
            if (bottomIndex >= 0 && bottomIndex < mazeCells.Count && !visitedCells.Contains(mazeCells[bottomIndex]))
            {
                neighborIndexs.Add(bottomIndex);
            }

            // Check left neighbor
            int leftIndex = cellIndex - 1;
            if (leftIndex >= 0 && leftIndex < mazeCells.Count &&
                leftIndex / mazeCellWidth == cellIndex / mazeCellWidth && // Same row
                !visitedCells.Contains(mazeCells[leftIndex]))
            {
                neighborIndexs.Add(leftIndex);
            }

            // Check right neighbor
            int rightIndex = cellIndex + 1;
            if (rightIndex >= 0 && rightIndex < mazeCells.Count &&
                rightIndex / mazeCellWidth == cellIndex / mazeCellWidth && // Same row
                !visitedCells.Contains(mazeCells[rightIndex]))
            {
                neighborIndexs.Add(rightIndex);
            }

            if (neighborIndexs.Count == 0)
            {
                return null;
            }
        }
        catch (Exception e)
        {
            Debug.LogError($"GetRandomNeighbor error: {e}");
            return null;
        }
        return mazeCells[neighborIndexs[random.Next(0, neighborIndexs.Count)]];
    }

    private int GetMazeCellIndex(Cell cell)
    {
        int res = cell.x / 2 + (cell.y / 2) * mazeCellWidth;
        if (res >= mazeCells.Count || res < 0)
        {
            Debug.LogError($"GetMazeCellIndex out of bounds: cell({cell.x},{cell.y}) -> index {res}, mazeCells.Count: {mazeCells.Count}");
            return 0; // Return safe default
        }
        return res;
    }

    // 对于两个迷宫格子判断相邻，他们中间至少有一个墙格子
    private bool IsCellNeighbor(int cellIndex1, int cellIndex2)
    {
        if (Math.Abs(cellIndex1 - cellIndex2) == 1)
        {
            return true;
        }
        if (Math.Abs(cellIndex1 - cellIndex2) == mazeCellWidth)
        {
            return true;
        }
        return false;
    }

    protected override void OnDestroy()
    {
        mazeCells.Clear();
    }
}