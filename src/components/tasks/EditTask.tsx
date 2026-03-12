import styled from "@emotion/styled";
import { CancelRounded, EditCalendarRounded, SaveRounded } from "@mui/icons-material";
import {
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  InputAdornment,
  MenuItem,
  TextField,
  TextFieldProps,
  Tooltip,
} from "@mui/material";
import { useContext, useEffect, useMemo, useState } from "react";
import { ColorPicker, CustomDialogTitle, CustomEmojiPicker } from "..";
import { DESCRIPTION_MAX_LENGTH, TASK_NAME_MAX_LENGTH } from "../../constants";
import { UserContext } from "../../contexts/UserContext";
import { DialogBtn } from "../../styles";
import type { Category, Task, TaskRecurrence } from "../../types/user";
import { formatDate, showToast, timeAgo } from "../../utils";
import { useTheme } from "@emotion/react";
import { ColorPalette } from "../../theme/themeConfig";
import { CategorySelect } from "../CategorySelect";
import { normalizeRecurrence } from "../../utils/recurrenceUtils";

const DEFAULT_EDIT_TASK_SUBTITLE = "Edit the details of the task.";

interface EditTaskProps {
  open: boolean;
  task?: Task;
  onClose: () => void;
}

export const EditTask = ({ open, task, onClose }: EditTaskProps) => {
  const { user, setUser } = useContext(UserContext);
  const { settings } = user;
  const [editedTask, setEditedTask] = useState<Task | undefined>(task);
  const [emoji, setEmoji] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [editLastSaveLabel, setEditLastSaveLabel] = useState<string>(DEFAULT_EDIT_TASK_SUBTITLE);

  const [recurrenceEnabled, setRecurrenceEnabled] = useState<boolean>(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<TaskRecurrence["frequency"]>(
    "daily",
  );
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(1);
  const [recurrenceUntil, setRecurrenceUntil] = useState<string>("");

  const theme = useTheme();

  const nameError = useMemo(
    () => (editedTask?.name ? editedTask.name.length > TASK_NAME_MAX_LENGTH : undefined),
    [editedTask?.name],
  );
  const descriptionError = useMemo(
    () => (editedTask?.description ? editedTask.description.length > DESCRIPTION_MAX_LENGTH : undefined),
    [editedTask?.description],
  );

  // Effect hook to update the editedTask with the selected emoji.
  useEffect(() => {
    setEditedTask((prevTask) => ({
      ...(prevTask as Task),
      emoji: emoji || undefined,
    }));
  }, [emoji]);

  // Effect hook to update the editedTask when the task prop changes.
  useEffect(() => {
    setEditedTask(task);
    setSelectedCategories(task?.category as Category[]);

    setRecurrenceEnabled(Boolean(task?.recurrence));
    setRecurrenceFrequency(task?.recurrence?.frequency || "daily");
    setRecurrenceInterval(task?.recurrence?.interval || 1);
    setRecurrenceUntil(
      task?.recurrence?.until ? new Date(task.recurrence.until).toISOString().slice(0, 10) : "",
    );

    if (task?.lastSave) {
      setEditLastSaveLabel(
        `Last edited ${timeAgo(new Date(task.lastSave))} • ${formatDate(new Date(task.lastSave))}`,
      );
    } else {
      setEditLastSaveLabel(DEFAULT_EDIT_TASK_SUBTITLE);
    }
  }, [task]);

  // Event handler for input changes in the form fields.
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    // Update the editedTask state with the changed value.
    setEditedTask((prevTask) => ({
      ...(prevTask as Task),
      [name]: value,
    }));
  };
  // Event handler for saving the edited task.
  const handleSave = () => {
    document.body.style.overflow = "auto";
    if (editedTask && !nameError && !descriptionError) {
      const recurrence: TaskRecurrence | undefined = recurrenceEnabled
        ? normalizeRecurrence({
            frequency: recurrenceFrequency,
            interval: Number(recurrenceInterval) || 1,
            until: recurrenceUntil !== "" ? new Date(recurrenceUntil) : undefined,
          })
        : undefined;

      const updatedTasks = user.tasks.map((t) => {
        if (t.id === editedTask.id) {
          return {
            ...t,
            name: editedTask.name,
            color: editedTask.color,
            emoji: editedTask.emoji || undefined,
            description: editedTask.description || undefined,
            deadline: editedTask.deadline || undefined,
            category: editedTask.category || undefined,
            recurrence: recurrenceEnabled ? recurrence : undefined,
            recurrenceState: recurrenceEnabled ? (t.recurrenceState || {}) : undefined,
            lastSave: new Date(),
          };
        }
        return t;
      });
      setUser((prevUser) => ({
        ...prevUser,
        tasks: updatedTasks,
      }));
      onClose();
      showToast(
        <div>
          Task <b translate="no">{editedTask.name}</b> updated.
        </div>,
      );
    }
  };

  const handleCancel = () => {
    onClose();
    setEditedTask(task);
    setSelectedCategories(task?.category as Category[]);
  };

  useEffect(() => {
    setEditedTask((prevTask) => ({
      ...(prevTask as Task),
      category: (selectedCategories as Category[]) || undefined,
    }));
  }, [selectedCategories]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(editedTask) !== JSON.stringify(task) && open) {
        const message = "You have unsaved changes. Are you sure you want to leave?";
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [editedTask, open, task]);

  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose();
      }}
      slotProps={{
        paper: {
          style: {
            borderRadius: "24px",
            padding: "12px",
            maxWidth: "600px",
          },
        },
      }}
    >
      <CustomDialogTitle
        title="Edit Task"
        subTitle={editLastSaveLabel}
        icon={<EditCalendarRounded />}
        onClose={onClose}
      />

      <DialogContent>
        <CustomEmojiPicker
          emoji={editedTask?.emoji || undefined}
          setEmoji={setEmoji}
          color={editedTask?.color}
          name={editedTask?.name || ""}
          type="task"
        />
        <StyledInput
          label="Name"
          name="name"
          autoComplete="off"
          value={editedTask?.name || ""}
          onChange={handleInputChange}
          error={nameError || editedTask?.name === ""}
          helperText={
            editedTask?.name
              ? editedTask?.name.length === 0
                ? "Name is required"
                : editedTask?.name.length > TASK_NAME_MAX_LENGTH
                  ? `Name is too long (maximum ${TASK_NAME_MAX_LENGTH} characters)`
                  : `${editedTask?.name?.length}/${TASK_NAME_MAX_LENGTH}`
              : "Name is required"
          }
        />
        <StyledInput
          label="Description"
          name="description"
          autoComplete="off"
          value={editedTask?.description || ""}
          onChange={handleInputChange}
          multiline
          rows={4}
          margin="normal"
          error={descriptionError}
          helperText={
            editedTask?.description === "" || editedTask?.description === undefined
              ? undefined
              : descriptionError
                ? `Description is too long (maximum ${DESCRIPTION_MAX_LENGTH} characters)`
                : `${editedTask?.description?.length}/${DESCRIPTION_MAX_LENGTH}`
          }
        />
        <StyledInput
          label="Deadline date"
          name="deadline"
          type="datetime-local"
          value={
            editedTask?.deadline
              ? new Date(editedTask.deadline).toLocaleString("sv").replace(" ", "T").slice(0, 16)
              : ""
          }
          onChange={handleInputChange}
          slotProps={{
            inputLabel: {
              shrink: true,
            },
            input: {
              startAdornment: editedTask?.deadline ? (
                <InputAdornment position="start">
                  <Tooltip title="Clear">
                    <IconButton
                      color="error"
                      onClick={() => {
                        setEditedTask((prevTask) => ({
                          ...(prevTask as Task),
                          deadline: undefined,
                        }));
                      }}
                    >
                      <CancelRounded />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ) : undefined,
            },
          }}
          sx={{
            colorScheme: theme.darkmode ? "dark" : "light",
            " & .MuiInputBase-root": {
              transition: ".3s all",
            },
          }}
        />

        <StyledInput
          select
          label="Recurring"
          name="recurrenceEnabled"
          value={recurrenceEnabled ? "yes" : "no"}
          onChange={(e) => setRecurrenceEnabled(e.target.value === "yes")}
          helperText="Set a schedule to repeat this task."
        >
          <MenuItem value="no">No</MenuItem>
          <MenuItem value="yes">Yes</MenuItem>
        </StyledInput>

        {recurrenceEnabled && (
          <>
            <StyledInput
              select
              label="Repeat frequency"
              name="recurrenceFrequency"
              value={recurrenceFrequency}
              onChange={(e) =>
                setRecurrenceFrequency(e.target.value as TaskRecurrence["frequency"])
              }
            >
              <MenuItem value="daily">Daily</MenuItem>
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="monthly">Monthly</MenuItem>
            </StyledInput>

            <StyledInput
              label="Repeat every"
              name="recurrenceInterval"
              type="number"
              value={recurrenceInterval}
              onChange={(e) => setRecurrenceInterval(Math.max(1, Number(e.target.value) || 1))}
              slotProps={{
                input: { inputProps: { min: 1, step: 1 } },
              }}
              helperText="Interval (e.g., every 2 weeks)."
            />

            <StyledInput
              label="Repeat until (optional)"
              name="recurrenceUntil"
              type="date"
              value={recurrenceUntil}
              onChange={(e) => setRecurrenceUntil(e.target.value)}
              slotProps={{
                inputLabel: { shrink: true },
                input: {
                  startAdornment: recurrenceUntil ? (
                    <InputAdornment position="start">
                      <Tooltip title="Clear">
                        <IconButton color="error" onClick={() => setRecurrenceUntil("")}>
                          <CancelRounded />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ) : undefined,
                },
              }}
            />
          </>
        )}

        {settings.enableCategories !== undefined && settings.enableCategories && (
          <CategorySelect
            fontColor={theme.darkmode ? ColorPalette.fontLight : ColorPalette.fontDark}
            selectedCategories={selectedCategories}
            onCategoryChange={(categories) => setSelectedCategories(categories)}
          />
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginTop: "8px",
          }}
        >
          <ColorPicker
            width={"100%"}
            color={editedTask?.color || "#000000"}
            fontColor={theme.darkmode ? ColorPalette.fontLight : ColorPalette.fontDark}
            onColorChange={(c) => {
              setEditedTask((prevTask) => ({
                ...(prevTask as Task),
                color: c,
              }));
            }}
          />
        </div>
      </DialogContent>
      <DialogActions>
        <DialogBtn onClick={handleCancel}>Cancel</DialogBtn>
        <DialogBtn
          onClick={handleSave}
          color="primary"
          disabled={
            nameError ||
            editedTask?.name === "" ||
            descriptionError ||
            nameError ||
            JSON.stringify(editedTask) === JSON.stringify(task)
          }
        >
          <SaveRounded /> &nbsp; Save
        </DialogBtn>
      </DialogActions>
    </Dialog>
  );
};

const UnstyledTextField = ({ ...props }: TextFieldProps) => <TextField fullWidth {...props} />;

const StyledInput = styled(UnstyledTextField)`
  margin: 14px 0;
  & .MuiInputBase-root {
    border-radius: 16px;
  }
`;
